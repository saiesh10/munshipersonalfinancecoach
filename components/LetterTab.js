'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLedger } from '@/context/LedgerContext';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Mic,
  Send,
  Sparkles,
  Volume2,
  CheckCircle2,
  Loader2,
  Globe
} from 'lucide-react';
import Card from './ui/Card';
import Button from './ui/Button';
import Segmented from './ui/Segmented';
import Select from './ui/Select';
import Skeleton from './ui/Skeleton';
import FutureYouAvatar from './FutureYouAvatar';
import { isSupported as isTtsSupported, speak, pause, resume, stop, splitSentences } from '@/lib/voice';
import { isSupported as isSttSupported, listen, stopListening } from '@/lib/stt';
import { askFuture } from '@/lib/client';
import { formatRupees } from './ui/format';

export default function LetterTab() {
  const {
    letter,
    handleGenerateLetter,
    isLoading: isLetterLoading,
    error: letterError,
    projection,
    goal,
    profile
  } = useLedger();

  // Language state: 'en' | 'hi'
  const [language, setLanguage] = useState('en');

  // TTS State
  const [ttsSupported, setTtsSupported] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);
  const [speed, setSpeed] = useState('1x');
  const [voiceTone, setVoiceTone] = useState('Warm');

  // STT & Ask State
  const [sttSupported, setSttSupported] = useState(false);
  const [sttState, setSttState] = useState('idle'); // 'idle' | 'listening' | 'error'
  const [questionInput, setQuestionInput] = useState('');
  const [conversation, setConversation] = useState([]);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState(null);
  const [speakingAnswerIndex, setSpeakingAnswerIndex] = useState(-1);

  useEffect(() => {
    setTtsSupported(isTtsSupported());
    setSttSupported(isSttSupported());

    return () => {
      stop();
      stopListening();
    };
  }, []);

  const letterSentences = letter?.text ? splitSentences(letter.text) : [];

  // Parse speed numeric value
  const getNumericRate = () => {
    if (speed === '0.9x') return 0.9;
    if (speed === '1.25x') return 1.25;
    return 1.0;
  };

  // Play Letter Audio from sentence index
  const handlePlayFromIndex = (startIndex = 0) => {
    if (!letter?.text || !ttsSupported) return;

    setIsPlaying(true);
    setIsPaused(false);
    setActiveSentenceIndex(startIndex);

    // If starting from a specific sentence, speak from that sentence onward
    const textToSpeak = startIndex > 0 ? letterSentences.slice(startIndex).join(' ') : letter.text;

    speak(textToSpeak, {
      lang: language === 'hi' ? 'hi-IN' : 'en-IN',
      rate: getNumericRate(),
      onSentence: (idx) => {
        setActiveSentenceIndex(startIndex + idx);
      },
      onEnd: () => {
        setIsPlaying(false);
        setIsPaused(false);
        setActiveSentenceIndex(-1);
      }
    });
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      if (isPaused) {
        resume();
        setIsPaused(false);
      } else {
        pause();
        setIsPaused(true);
      }
    } else {
      handlePlayFromIndex(0);
    }
  };

  const handleStop = () => {
    stop();
    setIsPlaying(false);
    setIsPaused(false);
    setActiveSentenceIndex(-1);
    setSpeakingAnswerIndex(-1);
  };

  // Handle Language Switch
  const handleLanguageChange = (newLang) => {
    if (newLang === language) return;
    setLanguage(newLang);
    handleStop();
    // Regenerate letter in the chosen language if a letter is already loaded
    if (letter) {
      handleGenerateLetter(newLang);
    }
  };

  // Build summary payload for /api/ask
  const buildCurrentSummary = () => {
    const rentCost = profile?.fixedCosts?.find(f => /rent|housing/i.test(f.name))?.amount || 28000;
    return {
      goalName: goal?.name || 'Financial Goal',
      targetAmount: goal?.targetAmount || 500000,
      targetDate: goal?.targetDate || '2027-10-31',
      saved: profile?.saved || goal?.saved || 120000,
      monthlyIncome: projection?.monthlyIncome || 92000,
      monthlyFixed: projection?.monthlyFixed || 33000,
      monthlyVariable: projection?.monthlyVariable || 38430,
      monthlyNet: projection?.monthlyNet || 20570,
      whatIfNet: projection?.whatIfNet ?? null,
      shortfallAtTarget: projection?.shortfallAtTarget || 0,
      goalDateContinue: projection?.goalDateContinue || 'Nov 2027',
      goalDatePlan: projection?.goalDatePlan || 'Oct 2027',
      goalDateWhatIf: projection?.goalDateWhatIf || null,
      topCategory: projection?.topOverspend?.category || projection?.topCategories?.[0]?.category || 'Food & Dining',
      topCategories: projection?.topCategories || [],
      topOverspendRupeeGap: projection?.topOverspend?.rupeeGap || 2500,
      cutPctNeeded: projection?.cutPctNeeded || 15,
      currentRent: rentCost,
      fixedCosts: profile?.fixedCosts || [],
      lang: language
    };
  };

  // Ask Question Handler
  const submitQuestion = async (queryText) => {
    const q = (queryText || '').trim();
    if (!q || isAsking) return;

    setIsAsking(true);
    setAskError(null);
    setQuestionInput('');

    const historyPayload = conversation.slice(-3).map(turn => ({ q: turn.q, a: turn.a }));
    const summary = buildCurrentSummary();

    try {
      const res = await askFuture({
        question: q,
        summary,
        history: historyPayload
      });

      const newTurn = {
        q,
        a: res.answer,
        source: res.source
      };

      setConversation(prev => [...prev.slice(-2), newTurn]);

      // Speak answer automatically and articulate 3D model
      if (ttsSupported) {
        setSpeakingAnswerIndex(conversation.length);
        setIsPlaying(false);
        speak(res.answer, {
          lang: language === 'hi' ? 'hi-IN' : 'en-IN',
          rate: getNumericRate(),
          onEnd: () => setSpeakingAnswerIndex(-1)
        });
      }
    } catch (err) {
      setAskError(
        err.message ||
        (language === 'hi'
          ? 'भविष्य अभी उत्तर देने में असमर्थ है।'
          : 'Future You could not respond right now.')
      );
    } finally {
      setIsAsking(false);
    }
  };

  // Mic Speech Recognition Handler
  const handleMicClick = () => {
    if (sttState === 'listening') {
      stopListening();
      setSttState('idle');
      return;
    }

    listen({
      lang: language === 'hi' ? 'hi-IN' : 'en-IN',
      onResult: (transcript) => {
        setSttState('idle');
        submitQuestion(transcript, true);
      },
      onError: (err) => {
        setSttState('idle');
        setAskError(
          typeof err === 'string'
            ? err
            : (language === 'hi'
                ? 'आवाज़ सुनाई नहीं दी। कृपया अपना प्रश्न टाइप करें।'
                : 'Could not hear speech. Please type your question.')
        );
      },
      onEnd: () => setSttState('idle'),
      onStateChange: (state) => setSttState(state)
    });
  };

  const handleSpeakAnswer = (text, idx = 0) => {
    if (!ttsSupported) return;
    setSpeakingAnswerIndex(idx);
    setIsPlaying(false);
    speak(text, {
      lang: language === 'hi' ? 'hi-IN' : 'en-IN',
      rate: getNumericRate(),
      onEnd: () => setSpeakingAnswerIndex(-1)
    });
  };

  // Text download trigger
  const handleDownloadAudio = () => {
    if (!letter?.text) return;
    const blob = new Blob([letter.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `future_you_letter_${language}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-8 w-full max-w-3xl mx-auto pb-20">
      {/* Hero Section with Interactive 3D Model of Future You */}
      <div className="flex flex-col items-center justify-center text-center pt-4">
        {/* 3D Human Model Speaking Avatar */}
        <FutureYouAvatar
          isSpeaking={isPlaying || speakingAnswerIndex !== -1}
          isPaused={isPaused}
          size={140}
          className="mb-3"
        />

        <h2 className="font-serif text-[38px] sm:text-[40px] font-normal text-ink leading-tight">
          {language === 'hi' ? 'भविष्य का संदेश' : 'Future You'}
        </h2>
        <p className="text-[15px] text-muted mt-1 max-w-md">
          {language === 'hi'
            ? 'उस इंसान की आवाज़ सुनें जो आप बनने जा रहे हैं। आपकी मंज़िल की तारीख से एक ख़त।'
            : "Hear from the person you're becoming. A dispatch from your arrival date."}
        </p>

        {/* Dual Language Switcher Header */}
        <div className="mt-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted" />
          <Segmented
            size="sm"
            options={[
              { value: 'en', label: 'English' },
              { value: 'hi', label: 'हिंदी' }
            ]}
            value={language}
            onChange={handleLanguageChange}
            name="voice-language"
          />
        </div>
      </div>

      {/* When no letter exists yet: Generation Card */}
      {!letter ? (
        <Card className="p-8 text-center flex flex-col items-center justify-center gap-4">
          {isLetterLoading ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary stroke-[2]" />
              <p className="font-serif text-[18px] text-ink italic">
                {language === 'hi'
                  ? 'मुंशी आपका ख़त तैयार कर रहा है...'
                  : 'Munshi is writing your testimony...'}
              </p>
              <Skeleton className="w-64 h-3.5 mt-2" />
              <Skeleton className="w-48 h-3.5" />
            </div>
          ) : (
            <>
              <p className="text-[14px] text-muted max-w-md leading-relaxed">
                {language === 'hi'
                  ? 'मुंशी आपकी वर्तमान बचत, आदतों और लक्ष्य की तारीख का विश्लेषण करके भविष्य के आगमन दिन से एक व्यक्तिगत संदेश तैयार करता है।'
                  : 'Munshi summarizes your current savings margin, recurring leaks, and target horizon to generate a personal letter from your arrival milestone.'}
              </p>
              <Button
                variant="primary"
                size="lg"
                icon={Sparkles}
                onClick={() => handleGenerateLetter(language)}
              >
                {language === 'hi' ? 'मेरा ख़त लिखें' : 'Write my letter'}
              </Button>
            </>
          )}
        </Card>
      ) : (
        <>
          {/* Controls Card */}
          <Card className="p-4 sm:p-5 flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Big Play/Pause Button + Status */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="w-12 h-12 rounded-full bg-primary hover:bg-primary-hover text-white flex items-center justify-center shadow-lift active:scale-95 transition-all cursor-pointer"
                  aria-label={isPlaying && !isPaused ? 'Pause reading' : 'Listen to letter'}
                >
                  {isPlaying && !isPaused ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>

                <div className="flex flex-col">
                  <span className="text-[14px] font-semibold text-ink leading-tight">
                    {isPlaying
                      ? isPaused
                        ? (language === 'hi' ? 'रुक गया' : 'Paused')
                        : (language === 'hi' ? 'ख़त सुना रहे हैं…' : 'Speaking letter…')
                      : (language === 'hi' ? 'ख़त सुनें' : 'Listen to letter')}
                  </span>
                  <span className="text-[12px] text-muted">
                    {ttsSupported
                      ? (language === 'hi' ? 'हिंदी प्राकृतिक स्वर (Natural Hindi Audio)' : 'Indian English narration (Natural Neural)')
                      : 'Speech synthesis not available'}
                  </span>
                </div>
              </div>

              {/* Speed & Voice Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <Segmented
                  size="sm"
                  options={[
                    { value: '0.9x', label: '0.9x' },
                    { value: '1x', label: '1x' },
                    { value: '1.25x', label: '1.25x' }
                  ]}
                  value={speed}
                  onChange={setSpeed}
                  name="tts-speed"
                />

                <div className="w-24">
                  <Select
                    options={['Warm', 'Calm', 'Deep']}
                    value={voiceTone}
                    onChange={(e) => setVoiceTone(e.target.value)}
                  />
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  icon={Download}
                  onClick={handleDownloadAudio}
                  aria-label="Download testimony"
                >
                  <span className="hidden sm:inline">
                    {language === 'hi' ? 'डाउनलोड' : 'Download'}
                  </span>
                </Button>
              </div>
            </div>

            {/* Sentence-level Read Progress Bar */}
            {letterSentences.length > 0 && (
              <div className="flex flex-col gap-1.5 pt-1">
                <div className="w-full bg-canvas h-1.5 rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{
                      width: `${
                        activeSentenceIndex >= 0
                          ? ((activeSentenceIndex + 1) / letterSentences.length) * 100
                          : 0
                      }%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted">
                  <span>
                    {language === 'hi'
                      ? `वाक्य ${activeSentenceIndex >= 0 ? activeSentenceIndex + 1 : 1} / ${letterSentences.length}`
                      : `Sentence ${activeSentenceIndex >= 0 ? activeSentenceIndex + 1 : 1} of ${letterSentences.length}`}
                  </span>
                  <span>
                    {language === 'hi' ? 'सुनने के लिए किसी भी वाक्य पर क्लिक करें' : 'Click any sentence to seek'}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* The Letter Card (#FBF8F1, lifted shadow) */}
          <div
            className="p-8 sm:p-12 rounded-card border border-border shadow-lift relative flex flex-col gap-6"
            style={{ backgroundColor: '#FBF8F1' }}
          >
            {/* Date line */}
            <div className="flex items-center justify-between text-[13px] font-medium text-muted pb-4 border-b border-border/60">
              <span>
                {language === 'hi'
                  ? `${projection?.goalDatePlan || 'आगमन तिथि'} का संदेश`
                  : `Dispatch from ${projection?.goalDatePlan || 'the target arrival date'}`}
              </span>
              {letter.source === 'fallback' && (
                <span className="text-[12px] text-muted">
                  {language === 'hi' ? 'ऑफ़लाइन संदेश' : 'Offline testimony'}
                </span>
              )}
              {letter.source === 'gemini' && (
                <span className="text-[12px] text-muted">
                  Gemini 2.5 Flash
                </span>
              )}
            </div>

            {/* Letter Body in Fraunces 21px / 1.75 */}
            <div className="space-y-4">
              <span className="font-serif text-[20px] text-muted italic block">
                {language === 'hi' ? 'प्रिय मैं,' : 'Dear me,'}
              </span>

              <p className="font-serif text-[20px] sm:text-[21px] leading-[1.75] text-ink font-normal">
                {letterSentences.map((sentence, idx) => {
                  const isCurrent = activeSentenceIndex === idx;
                  return (
                    <span
                      key={idx}
                      onClick={() => handlePlayFromIndex(idx)}
                      className={`transition-colors duration-200 cursor-pointer rounded-[4px] px-0.5 ${
                        isCurrent
                          ? 'bg-primary-tint text-primary font-medium'
                          : 'hover:bg-canvas'
                      }`}
                    >
                      {sentence}{' '}
                    </span>
                  );
                })}
              </p>

              <div className="pt-4 font-serif text-[18px] text-muted italic">
                {language === 'hi'
                  ? `— तुम, ${projection?.goalDatePlan || 'भविष्य'}`
                  : `— You, ${projection?.goalDatePlan || 'Future Self'}`}
              </div>
            </div>

            {/* Retrigger Action */}
            <div className="pt-4 border-t border-border/60 flex items-center justify-between">
              <span className="text-[12px] text-muted">
                {language === 'hi'
                  ? 'यह ख़त केवल आपके वित्तीय आंकड़ों के आधार पर तैयार किया गया है।'
                  : 'Letters are generated strictly from your summary numbers.'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleGenerateLetter(language)}
                loading={isLetterLoading}
              >
                {language === 'hi' ? 'नया ख़त लिखें' : 'Write another'}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* "Ask Future You" Conversational Dialogue Section */}
      <Card className="p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary-tint text-primary flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-semibold text-[16px] text-ink">
                {language === 'hi' ? 'भविष्य से पूछें' : 'Ask Future You'}
              </h3>
              <p className="text-[12px] text-muted">
                {language === 'hi'
                  ? 'बोलकर या लिखकर अपने भविष्य से सलाह लें'
                  : 'Talk or type to hear advice from your future self'}
              </p>
            </div>
          </div>

          <span className="text-[12px] font-medium text-success bg-primary-tint px-2.5 py-0.5 rounded-full">
            {language === 'hi' ? 'सक्रिय' : 'Ready'}
          </span>
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium text-muted">
            {language === 'hi' ? 'पूछें:' : 'Ask:'}
          </span>
          {language === 'hi' ? (
            <>
              <button
                type="button"
                disabled={isAsking}
                onClick={() => submitQuestion('क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?')}
                className="px-3 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border text-ink transition-colors cursor-pointer"
              >
                "क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?"
              </button>
              <button
                type="button"
                disabled={isAsking}
                onClick={() => submitQuestion('मुझे सबसे पहले क्या कम करना चाहिए?')}
                className="px-3 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border text-ink transition-colors cursor-pointer"
              >
                "मुझे सबसे पहले क्या कम करना चाहिए?"
              </button>
              <button
                type="button"
                disabled={isAsking}
                onClick={() => submitQuestion('अगर किराया ₹3,000 बढ़ जाए तो क्या होगा?')}
                className="px-3 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border text-ink transition-colors cursor-pointer"
              >
                "अगर किराया ₹3,000 बढ़ जाए तो क्या होगा?"
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isAsking}
                onClick={() => submitQuestion('Will I make it?')}
                className="px-3 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border text-ink transition-colors cursor-pointer"
              >
                "Will I make it?"
              </button>
              <button
                type="button"
                disabled={isAsking}
                onClick={() => submitQuestion('What should I cut first?')}
                className="px-3 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border text-ink transition-colors cursor-pointer"
              >
                "What should I cut first?"
              </button>
              <button
                type="button"
                disabled={isAsking}
                onClick={() => submitQuestion('What if rent goes up ₹3,000?')}
                className="px-3 py-1 rounded-full text-[12px] font-medium bg-canvas hover:bg-border text-ink transition-colors cursor-pointer"
              >
                "What if rent goes up ₹3,000?"
              </button>
            </>
          )}
        </div>

        {/* Conversation Message Bubbles */}
        {conversation.length > 0 && (
          <div className="space-y-4 py-2">
            {conversation.map((turn, idx) => (
              <div key={idx} className="space-y-3">
                {/* User Message on Right */}
                <div className="flex justify-end">
                  <div className="bg-primary-tint text-primary text-[14px] font-medium px-4 py-2.5 rounded-[14px] rounded-tr-none max-w-md shadow-sm">
                    {turn.q}
                  </div>
                </div>

                {/* Future You Message on Left */}
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent-saffron shrink-0 shadow-sm flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4 stroke-[2]" />
                  </div>
                  <div className="bg-surface border border-border text-ink text-[14px] p-3.5 rounded-[14px] rounded-tl-none max-w-lg shadow-sm flex flex-col gap-2">
                    <p className="leading-relaxed">{turn.a}</p>
                    {ttsSupported && (
                      <button
                        type="button"
                        onClick={() => handleSpeakAnswer(turn.a, idx)}
                        className={`text-[12px] font-medium flex items-center gap-1.5 self-start cursor-pointer pt-1 transition-colors ${
                          speakingAnswerIndex === idx
                            ? 'text-accent-saffron font-semibold'
                            : 'text-primary hover:underline'
                        }`}
                      >
                        <Volume2 className={`w-3.5 h-3.5 ${speakingAnswerIndex === idx ? 'animate-pulse' : ''}`} />
                        <span>
                          {speakingAnswerIndex === idx
                            ? (language === 'hi' ? 'बोल रहे हैं…' : 'Speaking…')
                            : (language === 'hi' ? 'सुनें' : 'Hear it')}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Typing Indicator while thinking */}
        {isAsking && (
          <div className="flex items-center gap-2 text-muted text-[13px] py-1">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>
              {language === 'hi' ? 'भविष्य विचार कर रहा है…' : 'Future You is thinking…'}
            </span>
          </div>
        )}

        {/* Input Form with Voice Mic & Text Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(questionInput, false);
          }}
          className="flex items-center gap-2 pt-2 border-t border-border"
        >
          {sttSupported && (
            <button
              type="button"
              disabled={isAsking}
              onClick={handleMicClick}
              className={`h-10 px-3.5 rounded-control border flex items-center gap-1.5 text-[13px] font-medium transition-all cursor-pointer shrink-0 ${
                sttState === 'listening'
                  ? 'bg-accent-saffron text-white border-accent-saffron animate-pulse shadow-sm'
                  : 'bg-canvas border-border text-ink hover:bg-surface'
              }`}
            >
              <Mic className="w-4 h-4 stroke-[2]" />
              <span>
                {sttState === 'listening'
                  ? (language === 'hi' ? 'सुन रहे हैं…' : 'Listening…')
                  : (language === 'hi' ? 'बोलें' : 'Speak')}
              </span>
            </button>
          )}

          <div className="relative flex-1">
            <input
              type="text"
              value={questionInput}
              disabled={isAsking || sttState === 'listening'}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder={
                sttState === 'listening'
                  ? (language === 'hi' ? 'आपकी आवाज़ सुन रहे हैं...' : 'Listening to your voice...')
                  : (language === 'hi' ? 'किराए, बचत या कटौती के बारे में पूछें...' : 'Ask about rent hikes, savings, or what to trim...')
              }
              className="w-full bg-canvas border border-border rounded-control h-10 px-3.5 text-[14px] text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isAsking || !questionInput.trim()}
            icon={Send}
          >
            {language === 'hi' ? 'भेजें' : 'Send'}
          </Button>
        </form>

        {askError && (
          <p className="text-[12px] text-danger mt-1">{askError}</p>
        )}
      </Card>
    </div>
  );
}
