/**
 * @file lib/stt.js
 * Browser Speech Recognition (Speech-to-Text) wrapper.
 * Uses window.SpeechRecognition or window.webkitSpeechRecognition with en-IN dialect.
 */

let activeRecognition = null;

/**
 * Check if browser supports Web Speech Recognition.
 * Supported in Chrome and Edge; unsupported in Firefox/Safari.
 * @returns {boolean}
 */
export function isSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Start listening for speech input.
 * @param {Object} options
 * @param {function(string): void} options.onResult
 * @param {function(string): void} [options.onError]
 * @param {function(): void} [options.onEnd]
 * @param {function('idle' | 'listening' | 'error'): void} [options.onStateChange]
 * @returns {function(): void} Stop function
 */
export function listen({ onResult, onError, onEnd, onStateChange, lang = 'en-IN' }) {
  if (!isSupported()) {
    if (typeof onError === 'function') {
      onError('Speech recognition is not supported in this browser.');
    }
    return () => {};
  }

  stopListening();

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  activeRecognition = recognition;

  recognition.lang = lang.startsWith('hi') ? 'hi-IN' : 'en-IN';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  if (typeof onStateChange === 'function') {
    onStateChange('listening');
  }

  recognition.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    if (typeof onResult === 'function' && transcript.trim()) {
      onResult(transcript.trim());
    }
  };

  recognition.onerror = (event) => {
    if (typeof onStateChange === 'function') {
      onStateChange('error');
    }
    if (typeof onError === 'function') {
      let msg = event.error || 'Speech recognition encountered an issue.';
      if (event.error === 'not-allowed') {
        msg = 'Microphone access was denied. You can still type your question below.';
      } else if (event.error === 'no-speech') {
        msg = 'No speech was detected. Please try speaking again.';
      }
      onError(msg);
    }
  };

  recognition.onend = () => {
    activeRecognition = null;
    if (typeof onStateChange === 'function') {
      onStateChange('idle');
    }
    if (typeof onEnd === 'function') {
      onEnd();
    }
  };

  try {
    recognition.start();
  } catch (err) {
    if (typeof onStateChange === 'function') {
      onStateChange('error');
    }
    if (typeof onError === 'function') {
      onError(err.message || 'Could not start speech recognition.');
    }
  }

  return stopListening;
}

/**
 * Stop any active speech recognition session.
 */
export function stopListening() {
  if (activeRecognition) {
    try {
      activeRecognition.stop();
    } catch {}
    activeRecognition = null;
  }
}
