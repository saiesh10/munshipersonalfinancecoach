/**
 * @file lib/voice.js
 * High-fidelity, natural speech engine for Future You in both English and Hindi.
 * Combines zero-cost realistic neural audio streaming via /api/tts with an enhanced
 * browser SpeechSynthesis fallback prioritizing natural/neural voices.
 */

let activeAudio = null;
let activeUtterance = null;
let currentSentenceIndex = -1;
let sentencesList = [];
let onSentenceCallback = null;
let onEndCallback = null;
let keepAliveTimer = null;
let isPausedState = false;
let currentEngine = 'neural'; // 'neural' | 'synthesis'
let currentLang = 'en-IN';
let currentRate = 1.0;
let currentSessionId = 0; // Incremented on every speak/stop to cancel stale streams and prevent overlaps

/**
 * Check if voice playback is supported in the current browser.
 * @returns {boolean}
 */
export function isSupported() {
  if (typeof window === 'undefined') return false;
  return typeof Audio !== 'undefined' || ('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
}

/**
 * Split text into natural sentences for sequential playback and sentence-level tracking.
 * Preserves decimals (₹1,499.00, 2.5%), titles, and supports Hindi poorna viraam (।).
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Split on punctuation (.!?\n or Hindi ।) followed by space, avoiding decimals and titles
  const parts = cleaned.split(/(?<!\b(?:Rs|No|Mr|Mrs|Dr))(?<=[.!?\n।])\s+/);
  return parts.map(s => s.trim()).filter(Boolean);
}

/**
 * Find the most realistic, natural neural voice available on the device.
 * Prioritizes Microsoft Natural Neural, Google Neural, Apple Enhanced, and Android Network voices.
 * Excludes metallic legacy desktop voices (like Microsoft David Desktop).
 * @param {string} [lang='en-IN']
 * @returns {SpeechSynthesisVoice | null}
 */
export function pickBestVoice(lang = 'en-IN') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const isHindi = lang.toLowerCase().startsWith('hi');

  if (isHindi) {
    // 1. Natural / Neural Hindi voices
    const hindiPreferences = [
      'swara online (natural)',
      'swara',
      'madhur online (natural)',
      'madhur',
      'google हिन्दी',
      'google hindi',
      'lekha (enhanced)',
      'lekha',
      'hi-in-x-hie-network',
      'hi-in-x-hie-local'
    ];

    const hiVoices = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('hi'));
    for (const name of hindiPreferences) {
      const match = hiVoices.find(v => v.name.toLowerCase().includes(name));
      if (match) return match;
    }
    if (hiVoices.length > 0) return hiVoices[0];
    // Strictly return null for Hindi if no genuine Hindi voice is installed.
    // Never fall back to an English voice that would mispronounce Devanagari phonetics.
    return null;
  } else {
    // 2. Natural / Neural Indian English & Natural English voices
    const englishPreferences = [
      'neerja online (natural)',
      'neerja',
      'prabhat online (natural)',
      'prabhat',
      'google english (india)',
      'rishi (enhanced)',
      'rishi',
      'google uk english female',
      'google us english',
      'aria online (natural)',
      'jenny online (natural)',
      'samantha',
      'en-in-x-end-network'
    ];

    // Priority 1: Indian English Natural
    const enInVoices = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en-in'));
    for (const name of englishPreferences) {
      const match = enInVoices.find(v => v.name.toLowerCase().includes(name));
      if (match) return match;
    }
    if (enInVoices.length > 0) return enInVoices[0];

    // Priority 2: High quality English Natural
    const allEnVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
    for (const name of englishPreferences) {
      const match = allEnVoices.find(v => v.name.toLowerCase().includes(name));
      if (match) return match;
    }

    // Filter out robotic SAPI voices if alternative exists
    const nonRobotic = allEnVoices.filter(v => !v.name.toLowerCase().includes('desktop'));
    if (nonRobotic.length > 0) return nonRobotic[0];
  }

  return voices[0] || null;
}

/**
 * Clear keep-alive timer.
 */
function clearKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/**
 * Chrome keep-alive watchdog for SpeechSynthesis.
 */
function startKeepAlive() {
  clearKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis?.speaking && !isPausedState) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 5000);
}

/**
 * Play next sentence using browser SpeechSynthesis fallback.
 */
function speakNextSynthesisSentence(sessionId) {
  if (sessionId !== currentSessionId) return;
  if (sentencesList.length === 0) return;

  currentSentenceIndex++;
  if (currentSentenceIndex >= sentencesList.length) {
    const finishCb = onEndCallback;
    stop();
    if (typeof finishCb === 'function') finishCb();
    return;
  }

  const textToSpeak = sentencesList[currentSentenceIndex];
  if (typeof onSentenceCallback === 'function') {
    onSentenceCallback(currentSentenceIndex);
  }

  const utterance = new window.SpeechSynthesisUtterance(textToSpeak);
  activeUtterance = utterance;

  const isHindi = currentLang.toLowerCase().startsWith('hi');
  const voice = pickBestVoice(currentLang);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    // If Hindi voice is not available in SpeechSynthesis, never force an English voice to read Hindi
    if (isHindi) {
      stop();
      if (typeof onEndCallback === 'function') onEndCallback();
      return;
    }
    utterance.lang = 'en-IN';
  }

  utterance.rate = currentRate || 1.0;
  utterance.pitch = 1.0;

  utterance.onend = () => {
    if (sessionId !== currentSessionId || activeUtterance !== utterance) return;
    if (!isPausedState && sentencesList.length > 0) {
      speakNextSynthesisSentence(sessionId);
    }
  };

  utterance.onerror = (e) => {
    if (sessionId !== currentSessionId || activeUtterance !== utterance) return;
    if (e.error === 'canceled' || e.error === 'interrupted') return;
    const finishCb = onEndCallback;
    stop();
    if (typeof finishCb === 'function') finishCb();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Play next sentence using realistic neural audio streaming via /api/tts.
 */
function playNextNeuralSentence(sessionId) {
  if (sessionId !== currentSessionId) return;
  if (sentencesList.length === 0) return;

  currentSentenceIndex++;
  if (currentSentenceIndex >= sentencesList.length) {
    const finishCb = onEndCallback;
    stop();
    if (typeof finishCb === 'function') finishCb();
    return;
  }

  const sentence = sentencesList[currentSentenceIndex];
  if (typeof onSentenceCallback === 'function') {
    onSentenceCallback(currentSentenceIndex);
  }

  const ttsLang = currentLang.startsWith('hi') ? 'hi' : 'en-IN';
  const url = `/api/tts?text=${encodeURIComponent(sentence)}&lang=${ttsLang}`;

  let hasFallenBack = false;

  const handleFallback = () => {
    if (sessionId !== currentSessionId || hasFallenBack) return;
    hasFallenBack = true;

    if (activeAudio) {
      activeAudio.onended = null;
      activeAudio.onerror = null;
    }

    currentEngine = 'synthesis';
    currentSentenceIndex--; // retry current sentence in synthesis
    startKeepAlive();
    speakNextSynthesisSentence(sessionId);
  };

  try {
    const audio = new Audio(url);
    activeAudio = audio;
    audio.playbackRate = currentRate || 1.0;

    audio.onended = () => {
      if (sessionId !== currentSessionId || activeAudio !== audio) return;
      if (!isPausedState && sentencesList.length > 0) {
        playNextNeuralSentence(sessionId);
      }
    };

    audio.onerror = () => {
      handleFallback();
    };

    audio.play().catch(() => {
      handleFallback();
    });
  } catch {
    handleFallback();
  }
}

/**
 * Speak text with natural cadence, sentence-level tracking, and language support.
 * @param {string} text
 * @param {Object} [options]
 * @param {string} [options.lang='en-IN'] - 'en-IN' or 'hi-IN'
 * @param {number} [options.rate=1.0] - Speed multiplier (0.9, 1.0, 1.25)
 * @param {'neural' | 'synthesis'} [options.mode='neural'] - 'neural' (realistic) or 'synthesis'
 * @param {function(number): void} [options.onSentence] - Callback with sentence index
 * @param {function(): void} [options.onEnd] - Callback when complete
 */
export function speak(text, {
  lang = 'en-IN',
  rate = 1.0,
  mode = 'neural',
  onSentence,
  onEnd
} = {}) {
  if (!text) return;

  stop();

  sentencesList = splitSentences(text);
  if (sentencesList.length === 0) return;

  const sessionId = ++currentSessionId;
  currentSentenceIndex = -1;
  currentLang = lang;
  currentRate = rate;
  currentEngine = mode;
  onSentenceCallback = onSentence || null;
  onEndCallback = onEnd || null;
  isPausedState = false;

  if (mode === 'neural') {
    playNextNeuralSentence(sessionId);
  } else {
    startKeepAlive();
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        if (sessionId !== currentSessionId) return;
        window.speechSynthesis.onvoiceschanged = null;
        speakNextSynthesisSentence(sessionId);
      };
    } else {
      speakNextSynthesisSentence(sessionId);
    }
  }
}

/**
 * Pause speaking.
 */
export function pause() {
  isPausedState = true;
  if (activeAudio) {
    activeAudio.pause();
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.pause();
  }
}

/**
 * Resume speaking.
 */
export function resume() {
  isPausedState = false;
  if (activeAudio) {
    activeAudio.play().catch(() => {});
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.resume();
  }
}

/**
 * Stop speaking immediately and reset state.
 */
export function stop() {
  currentSessionId++; // Invalidate any in-flight asynchronous audio/synthesis callbacks
  clearKeepAlive();
  isPausedState = false;
  currentSentenceIndex = -1;
  sentencesList = [];
  onSentenceCallback = null;

  if (activeAudio) {
    // Unbind listeners first so clearing src doesn't trigger error callbacks
    activeAudio.onended = null;
    activeAudio.onerror = null;
    try {
      activeAudio.pause();
      activeAudio.src = '';
    } catch {}
    activeAudio = null;
  }

  if (activeUtterance) {
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
    activeUtterance = null;
  }

  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}
