import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { useAuth } from './AuthContext';
import {
  AccessibilitySettings,
  ExtendedQuizTimeMultiplier,
  SpeechSpeed
} from '../types';
import {
  parseSpokenNumber,
  splitIntoSentences
} from '../lib/speechUtils';

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  accessibilityMode: false,
  voiceAssistantEnabled: false,
  readAloudEnabled: true,
  textScale: 100,
  highContrast: false,
  reduceMotion: false,
  speechSpeed: 'normal',
  speechVoice: '',
  extendedQuizTime: 1
};

const STORAGE_KEY_SETTINGS = 'sot_accessibility_settings';
const STORAGE_KEY_MIC_PRIVACY = 'sot_mic_privacy_seen';

export const MIC_PRIVACY_NOTICE_TEXT =
  "Your voice is processed by your browser's speech service to understand commands. The app does not store your voice.";

export const VOICE_FALLBACK_TEXT =
  'I did not understand. Say what can I say for help.';

export interface VoiceCommandHandlers {
  // Navigation
  goHome?: () => string | void;
  openCourses?: () => string | void;
  openPastQuestions?: () => string | void;
  openTimetable?: () => string | void;
  openAnnouncements?: () => string | void;
  openQuizzes?: () => string | void;
  goBack?: () => string | void;

  // Courses & Lessons
  openCourse?: (courseQuery: string) => string | void;
  goToTopic?: (topicNumber: number | null, rawQuery: string) => string | void;
  nextTopic?: () => string | void;
  previousTopic?: () => string | void;
  listTopics?: () => string | void;
  markTopicComplete?: () => string | void;
  bookmarkThis?: () => string | void;

  // Reading content
  getSummaryText?: () => string;
  getNotesBlocks?: () => string[];
  getPageBlocks?: () => string[];
  getPageDescription?: () => string;

  // Quiz
  startQuiz?: () => string | void;
  readQuestion?: () => string | void;
  repeatOptions?: () => string | void;
  selectOption?: (index: number, letter: string) => string | void;
  selectTrueFalse?: (value: boolean) => string | void;
  selectWordBankWord?: (spokenText: string, gapNumber?: number) => string | void;
  nextQuestion?: () => string | void;
  previousQuestion?: () => string | void;
  howMuchTimeIsLeft?: () => string | void;
  requestSubmitQuiz?: () => { confirmPrompt: string; onConfirm: () => void } | string | void;
}

interface PendingConfirmation {
  prompt: string;
  onConfirm: () => void;
}

interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  updateSettings: (partial: Partial<AccessibilitySettings>) => void;
  enableAccessibilityMode: () => void;
  resetAccessibilitySettings: () => void;

  // Settings Modal
  settingsModalOpen: boolean;
  openSettingsModal: () => void;
  closeSettingsModal: () => void;

  // Available Voices
  availableVoices: SpeechSynthesisVoice[];
  refreshVoices: () => void;

  // Speech Synthesis State & Controls
  isSpeaking: boolean;
  isPaused: boolean;
  activeSourceId: string | null;
  activeBlockIndex: number;
  activeSentenceIndex: number;
  activeSentenceText: string;
  speak: (text: string, onEnd?: () => void) => void;
  speakBlocks: (
    sourceId: string,
    blocks: string[],
    startBlockIdx?: number,
    onComplete?: () => void
  ) => void;
  pauseSpeech: () => void;
  resumeSpeech: () => void;
  stopSpeech: () => void;
  repeatSpeech: () => void;
  nextParagraph: () => void;
  previousParagraph: () => void;
  fasterSpeech: () => void;
  slowerSpeech: () => void;

  // Voice Assistant / Speech Recognition
  isListening: boolean;
  speechRecognitionSupported: boolean;
  privacyNoticePending: boolean;
  acceptMicPrivacyAndListen: () => void;
  dismissMicPrivacy: () => void;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  lastTranscript: string;
  lastAssistantReply: string;
  voiceError: string | null;
  clearVoiceStatus: () => void;
  processVoiceCommand: (rawText: string) => void;
  pendingConfirmation: PendingConfirmation | null;
  cancelPendingConfirmation: () => void;

  // Handler Registration
  registerVoiceHandlers: (id: string, getHandlers: () => VoiceCommandHandlers) => () => void;
}

const AccessibilityContext = createContext<AccessibilityContextValue | undefined>(undefined);

function getSpeedRate(speed: SpeechSpeed): number {
  if (speed === 'slow') return 0.78;
  if (speed === 'fast') return 1.38;
  return 1.0;
}

function getSpeechRecognitionCtor(): any {
  if (typeof window === 'undefined') return null;
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, updateAccessibilitySettings } = useAuth();

  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      if (saved) {
        return { ...DEFAULT_ACCESSIBILITY_SETTINGS, ...JSON.parse(saved) };
      }
    } catch {
      // ignore
    }
    return DEFAULT_ACCESSIBILITY_SETTINGS;
  });

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Sync settings from Firestore profile when user logs in / loads profile
  useEffect(() => {
    if (profile?.accessibilitySettings) {
      const merged: AccessibilitySettings = {
        ...DEFAULT_ACCESSIBILITY_SETTINGS,
        ...profile.accessibilitySettings,
        textScale: Math.min(200, Math.max(100, Number(profile.accessibilitySettings.textScale) || 100))
      };
      setSettings(merged);
      try {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }
  }, [profile?.uid, profile?.accessibilitySettings]);

  // Apply global HTML attributes & classes whenever accessibility settings change
  useEffect(() => {
    const html = document.documentElement;
    html.style.fontSize = `${settings.textScale}%`;

    if (settings.accessibilityMode) {
      html.classList.add('a11y-mode');
    } else {
      html.classList.remove('a11y-mode');
    }

    if (settings.highContrast) {
      html.classList.add('a11y-high-contrast');
    } else {
      html.classList.remove('a11y-high-contrast');
    }

    if (settings.reduceMotion) {
      html.classList.add('a11y-reduce-motion');
    } else {
      html.classList.remove('a11y-reduce-motion');
    }
  }, [settings]);

  const updateSettings = useCallback(
    (partial: Partial<AccessibilitySettings>) => {
      setSettings((prev) => {
        const nextScale =
          partial.textScale !== undefined
            ? Math.min(200, Math.max(100, partial.textScale))
            : prev.textScale;

        const next: AccessibilitySettings = {
          ...prev,
          ...partial,
          textScale: nextScale
        };

        try {
          localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(next));
        } catch {
          // ignore
        }

        if (user?.uid) {
          updateAccessibilitySettings(next).catch(() => {});
        }
        return next;
      });
    },
    [user?.uid, updateAccessibilitySettings]
  );

  // Speech Synthesis Voices
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const refreshVoices = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const list = window.speechSynthesis.getVoices();
    if (list && list.length > 0) {
      // Prioritize English voices at the top
      const sorted = [...list].sort((a, b) => {
        const aEn = a.lang.toLowerCase().startsWith('en') ? 0 : 1;
        const bEn = b.lang.toLowerCase().startsWith('en') ? 0 : 1;
        if (aEn !== bEn) return aEn - bEn;
        if (a.lang.toLowerCase() === 'en-ng') return -1;
        if (b.lang.toLowerCase() === 'en-ng') return 1;
        return a.name.localeCompare(b.name);
      });
      setAvailableVoices(sorted);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    refreshVoices();
    const synth = window.speechSynthesis;
    synth.onvoiceschanged = refreshVoices;
    return () => {
      synth.onvoiceschanged = null;
    };
  }, [refreshVoices]);

  // -------------------------------------------------------------
  // SPEECH SYNTHESIS ENGINE
  // -------------------------------------------------------------
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(-1);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState<number>(-1);
  const [activeSentenceText, setActiveSentenceText] = useState<string>('');

  const sessionTokenRef = useRef<number>(0);
  const activeQueueRef = useRef<{
    sourceId: string | null;
    blocks: string[];
    blockIdx: number;
    sentenceIdx: number;
    onComplete?: () => void;
  } | null>(null);
  const lastSpokenTextRef = useRef<string>('');

  const pickVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const selectedUri = settingsRef.current.speechVoice;
    if (selectedUri) {
      const exact = voices.find((v) => v.voiceURI === selectedUri || v.name === selectedUri);
      if (exact) return exact;
    }
    return (
      voices.find((v) => v.lang.toLowerCase() === 'en-ng') ||
      voices.find((v) => v.lang.toLowerCase().startsWith('en')) ||
      voices[0]
    );
  }, []);

  const stopSpeech = useCallback(() => {
    sessionTokenRef.current += 1;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveSourceId(null);
    setActiveBlockIndex(-1);
    setActiveSentenceIndex(-1);
    setActiveSentenceText('');
  }, []);

  const playFromQueue = useCallback(
    (
      token: number,
      sourceId: string | null,
      blocks: string[],
      bIdx: number,
      sIdx: number,
      onComplete?: () => void
    ) => {
      if (token !== sessionTokenRef.current) return;
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setIsSpeaking(false);
        return;
      }
      if (bIdx >= blocks.length) {
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveSourceId(null);
        setActiveBlockIndex(-1);
        setActiveSentenceIndex(-1);
        setActiveSentenceText('');
        onComplete?.();
        return;
      }

      const blockText = blocks[bIdx] || '';
      const sentences = splitIntoSentences(blockText);
      if (sentences.length === 0 || sIdx >= sentences.length) {
        playFromQueue(token, sourceId, blocks, bIdx + 1, 0, onComplete);
        return;
      }

      const sentence = sentences[sIdx];
      activeQueueRef.current = {
        sourceId,
        blocks,
        blockIdx: bIdx,
        sentenceIdx: sIdx,
        onComplete
      };

      setIsSpeaking(true);
      setIsPaused(false);
      setActiveSourceId(sourceId);
      setActiveBlockIndex(bIdx);
      setActiveSentenceIndex(sIdx);
      setActiveSentenceText(sentence);

      const utterance = new SpeechSynthesisUtterance(sentence);
      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-NG';
      }
      utterance.rate = getSpeedRate(settingsRef.current.speechSpeed);

      utterance.onend = () => {
        if (token !== sessionTokenRef.current) return;
        playFromQueue(token, sourceId, blocks, bIdx, sIdx + 1, onComplete);
      };

      utterance.onerror = () => {
        if (token !== sessionTokenRef.current) return;
        playFromQueue(token, sourceId, blocks, bIdx, sIdx + 1, onComplete);
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [pickVoice]
  );

  const speakBlocks = useCallback(
    (sourceId: string, blocks: string[], startBlockIdx = 0, onComplete?: () => void) => {
      const cleanBlocks = blocks.map((b) => b.trim()).filter(Boolean);
      if (cleanBlocks.length === 0) return;

      stopSpeech();
      const token = sessionTokenRef.current;
      const safeStart = Math.max(0, Math.min(startBlockIdx, cleanBlocks.length - 1));
      lastSpokenTextRef.current = cleanBlocks.join(' ');
      playFromQueue(token, sourceId, cleanBlocks, safeStart, 0, onComplete);
    },
    [stopSpeech, playFromQueue]
  );

  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      const cleaned = text?.trim();
      if (!cleaned) return;
      stopSpeech();
      const token = sessionTokenRef.current;
      lastSpokenTextRef.current = cleaned;
      playFromQueue(token, 'assistant-utterance', [cleaned], 0, 0, onEnd);
    },
    [stopSpeech, playFromQueue]
  );

  const pauseSpeech = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking && !isPaused) {
      try {
        window.speechSynthesis.pause();
        setIsPaused(true);
      } catch {
        // ignore
      }
    }
  }, [isSpeaking, isPaused]);

  const resumeSpeech = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (isSpeaking && isPaused) {
      try {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } catch {
        // ignore
      }
    }
  }, [isSpeaking, isPaused]);

  const repeatSpeech = useCallback(() => {
    if (activeQueueRef.current) {
      const q = activeQueueRef.current;
      speakBlocks(q.sourceId || 'repeat', q.blocks, q.blockIdx, q.onComplete);
    } else if (lastSpokenTextRef.current) {
      speak(lastSpokenTextRef.current);
    }
  }, [speakBlocks, speak]);

  const nextParagraph = useCallback(() => {
    const q = activeQueueRef.current;
    if (q && q.blocks.length > 0) {
      const nextIdx = Math.min(q.blocks.length - 1, q.blockIdx + 1);
      speakBlocks(q.sourceId || 'blocks', q.blocks, nextIdx, q.onComplete);
    }
  }, [speakBlocks]);

  const previousParagraph = useCallback(() => {
    const q = activeQueueRef.current;
    if (q && q.blocks.length > 0) {
      const prevIdx = Math.max(0, q.blockIdx - 1);
      speakBlocks(q.sourceId || 'blocks', q.blocks, prevIdx, q.onComplete);
    }
  }, [speakBlocks]);

  const fasterSpeech = useCallback(() => {
    const cur = settingsRef.current.speechSpeed;
    const next: SpeechSpeed = cur === 'slow' ? 'normal' : 'fast';
    updateSettings({ speechSpeed: next });
    if (isSpeaking && activeQueueRef.current) {
      const q = activeQueueRef.current;
      setTimeout(() => {
        stopSpeech();
        const token = sessionTokenRef.current;
        playFromQueue(token, q.sourceId, q.blocks, q.blockIdx, q.sentenceIdx, q.onComplete);
      }, 40);
    } else {
      speak(`Speech speed set to ${next}.`);
    }
  }, [updateSettings, isSpeaking, stopSpeech, playFromQueue, speak]);

  const slowerSpeech = useCallback(() => {
    const cur = settingsRef.current.speechSpeed;
    const next: SpeechSpeed = cur === 'fast' ? 'normal' : 'slow';
    updateSettings({ speechSpeed: next });
    if (isSpeaking && activeQueueRef.current) {
      const q = activeQueueRef.current;
      setTimeout(() => {
        stopSpeech();
        const token = sessionTokenRef.current;
        playFromQueue(token, q.sourceId, q.blocks, q.blockIdx, q.sentenceIdx, q.onComplete);
      }, 40);
    } else {
      speak(`Speech speed set to ${next}.`);
    }
  }, [updateSettings, isSpeaking, stopSpeech, playFromQueue, speak]);

  // -------------------------------------------------------------
  // HANDLER REGISTRY
  // -------------------------------------------------------------
  const registryRef = useRef<Map<string, () => VoiceCommandHandlers>>(new Map());

  const registerVoiceHandlers = useCallback((id: string, getHandlers: () => VoiceCommandHandlers) => {
    registryRef.current.set(id, getHandlers);
    return () => {
      registryRef.current.delete(id);
    };
  }, []);

  const getMergedHandlers = useCallback((): VoiceCommandHandlers => {
    const merged: VoiceCommandHandlers = {};
    registryRef.current.forEach((getH) => {
      const h = getH();
      (Object.keys(h) as Array<keyof VoiceCommandHandlers>).forEach((key) => {
        if (typeof h[key] === 'function') {
          (merged as any)[key] = h[key];
        }
      });
    });
    return merged;
  }, []);

  // -------------------------------------------------------------
  // VOICE ASSISTANT & COMMAND PARSER
  // -------------------------------------------------------------
  const [isListening, setIsListening] = useState(false);
  const [privacyNoticePending, setPrivacyNoticePending] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastAssistantReply, setLastAssistantReply] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const pendingConfirmRef = useRef<PendingConfirmation | null>(null);
  pendingConfirmRef.current = pendingConfirmation;

  const recognitionRef = useRef<any>(null);
  const speechRecognitionSupported = Boolean(getSpeechRecognitionCtor());

  const replyAndSpeak = useCallback(
    (message: string, onEnd?: () => void) => {
      setLastAssistantReply(message);
      setVoiceError(null);
      speak(message, onEnd);
    },
    [speak]
  );

  const extractVisiblePageBlocks = useCallback((): string[] => {
    const mainEl = document.getElementById('main-content') || document.body;
    const candidates = mainEl.querySelectorAll('h1, h2, h3, h4, p, li');
    const blocks: string[] = [];
    const seen = new Set<string>();
    candidates.forEach((el) => {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length >= 4 && !seen.has(text)) {
        seen.add(text);
        blocks.push(text);
      }
    });
    return blocks.slice(0, 60);
  }, []);

  const processVoiceCommand = useCallback(
    (rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;
      setLastTranscript(cleaned);
      const norm = cleaned
        .toLowerCase()
        .replace(/[.,!?'"()]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const handlers = getMergedHandlers();

      // 0. Check Pending Spoken Confirmation First (e.g. Quiz Submission)
      if (pendingConfirmRef.current) {
        if (/\b(yes|confirm|submit|yeah|sure|proceed|ok|okay)\b/.test(norm)) {
          const action = pendingConfirmRef.current.onConfirm;
          setPendingConfirmation(null);
          replyAndSpeak('Confirmed. Submitting now.');
          action();
          return;
        }
        if (/\b(no|cancel|wait|stop|dont|don t|back)\b/.test(norm)) {
          setPendingConfirmation(null);
          replyAndSpeak('Submission cancelled. You can continue reviewing your answers.');
          return;
        }
        replyAndSpeak('Please say yes to confirm submission, or no to cancel.');
        return;
      }

      // 1. Help & Page Overview
      if (/\b(what can i say|help|voice commands|command list)\b/.test(norm)) {
        const helpMsg =
          'You can say: Go home, open courses, open past questions, open timetable, open announcements, open quizzes, or go back. In courses say: open course COM 124, go to topic five, next topic, previous topic, read the notes, read the summary, pause, resume, stop, faster, or slower. In quizzes say: start quiz, read the question, option B, true, false, next question, how much time is left, or submit quiz.';
        replyAndSpeak(helpMsg);
        return;
      }

      if (/\b(what is on this page|where am i|describe this page)\b/.test(norm)) {
        const desc = handlers.getPageDescription?.();
        if (desc) {
          replyAndSpeak(desc);
        } else {
          const heading = document.querySelector('main h1, main h2, h1, h2')?.textContent?.trim();
          replyAndSpeak(
            heading
              ? `You are viewing ${heading}. Say read this page to hear the content, or say what can I say for commands.`
              : 'You are on the School of Technology portal. Say go home, open courses, or open quizzes.'
          );
        }
        return;
      }

      // 2. Reading Controls (Immediate Speech Control)
      if (/^(stop|stop reading|quiet|shut up|silence)$/.test(norm) || /\bstop reading\b/.test(norm)) {
        stopSpeech();
        setLastAssistantReply('Stopped reading.');
        return;
      }

      if (/^(pause|pause reading)$/.test(norm)) {
        pauseSpeech();
        setLastAssistantReply('Paused reading. Say resume to continue.');
        return;
      }

      if (/^(resume|continue|continue reading|play)$/.test(norm)) {
        resumeSpeech();
        setLastAssistantReply('Resumed reading.');
        return;
      }

      if (/^(repeat|say that again|again)$/.test(norm)) {
        repeatSpeech();
        setLastAssistantReply('Repeating.');
        return;
      }

      if (/\b(faster|speed up|read faster|speak faster)\b/.test(norm)) {
        fasterSpeech();
        setLastAssistantReply('Increased speech speed.');
        return;
      }

      if (/\b(slower|slow down|read slower|speak slower)\b/.test(norm)) {
        slowerSpeech();
        setLastAssistantReply('Decreased speech speed.');
        return;
      }

      if (/\b(next paragraph|skip paragraph)\b/.test(norm)) {
        if (activeQueueRef.current) {
          nextParagraph();
          setLastAssistantReply('Moving to next paragraph.');
        } else {
          replyAndSpeak('No lesson notes are currently playing. Say read the notes first.');
        }
        return;
      }

      if (/\b(previous paragraph|last paragraph|back paragraph)\b/.test(norm)) {
        if (activeQueueRef.current) {
          previousParagraph();
          setLastAssistantReply('Moving to previous paragraph.');
        } else {
          replyAndSpeak('No lesson notes are currently playing.');
        }
        return;
      }

      if (/\b(read the summary|read summary)\b/.test(norm)) {
        const summary = handlers.getSummaryText?.();
        if (summary) {
          setLastAssistantReply('Reading summary.');
          speakBlocks('lesson-summary', [summary]);
        } else {
          replyAndSpeak('No summary is available on this screen.');
        }
        return;
      }

      if (/\b(read the notes|read notes|read lesson)\b/.test(norm)) {
        const blocks = handlers.getNotesBlocks?.();
        if (blocks && blocks.length > 0) {
          setLastAssistantReply('Reading lesson notes.');
          speakBlocks('lesson-notes', blocks, 0);
        } else {
          replyAndSpeak('No lesson notes are open right now.');
        }
        return;
      }

      if (/\b(read this page|read page|read everything)\b/.test(norm)) {
        const customBlocks = handlers.getPageBlocks?.() || handlers.getNotesBlocks?.();
        const blocks = customBlocks && customBlocks.length > 0 ? customBlocks : extractVisiblePageBlocks();
        if (blocks.length > 0) {
          setLastAssistantReply('Reading page content.');
          speakBlocks('page-content', blocks, 0);
        } else {
          replyAndSpeak('Nothing readable was found on this page.');
        }
        return;
      }

      if (/\b(read from here|start reading here)\b/.test(norm)) {
        const blocks = handlers.getNotesBlocks?.() || handlers.getPageBlocks?.() || extractVisiblePageBlocks();
        if (blocks.length > 0) {
          const startAt = Math.max(0, activeBlockIndex >= 0 ? activeBlockIndex : 0);
          setLastAssistantReply(`Reading from paragraph ${startAt + 1}.`);
          speakBlocks(activeSourceId || 'lesson-notes', blocks, startAt);
        } else {
          replyAndSpeak('No notes are currently selected to read from.');
        }
        return;
      }

      // 3. Quiz Commands (Checked before general navigation so "next question" / options work cleanly)
      if (/\b(start quiz|begin quiz|take quiz|start the quiz)\b/.test(norm)) {
        if (handlers.startQuiz) {
          const res = handlers.startQuiz();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(read the question|read question|repeat question|what is the question)\b/.test(norm)) {
        if (handlers.readQuestion) {
          const res = handlers.readQuestion();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(repeat the options|repeat options|read options|read the options|what are the options)\b/.test(norm)) {
        if (handlers.repeatOptions) {
          const res = handlers.repeatOptions();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(how much time is left|time left|time remaining|how many minutes left)\b/.test(norm)) {
        if (handlers.howMuchTimeIsLeft) {
          const res = handlers.howMuchTimeIsLeft();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(next question)\b/.test(norm)) {
        if (handlers.nextQuestion) {
          const res = handlers.nextQuestion();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(previous question|last question|back question)\b/.test(norm)) {
        if (handlers.previousQuestion) {
          const res = handlers.previousQuestion();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(submit quiz|finish quiz|submit the quiz|done with quiz)\b/.test(norm)) {
        if (handlers.requestSubmitQuiz) {
          const result = handlers.requestSubmitQuiz();
          if (result && typeof result === 'object' && 'confirmPrompt' in result) {
            setPendingConfirmation({
              prompt: result.confirmPrompt,
              onConfirm: result.onConfirm
            });
            replyAndSpeak(result.confirmPrompt);
            return;
          } else if (typeof result === 'string') {
            replyAndSpeak(result);
            return;
          }
        }
      }

      // Option A..F matching ("option b", "choose option a", "answer c", "pick d")
      const optionMatch = norm.match(/\b(?:option|choice|answer|pick|select)\s+([a-f])\b/i);
      if (optionMatch && handlers.selectOption) {
        const letter = optionMatch[1].toUpperCase();
        const idx = letter.charCodeAt(0) - 65;
        const res = handlers.selectOption(idx, letter);
        if (typeof res === 'string') replyAndSpeak(res);
        return;
      }

      // Standalone single letter A-F while in quiz
      if (/^[a-f]$/.test(norm) && handlers.selectOption) {
        const letter = norm.toUpperCase();
        const idx = letter.charCodeAt(0) - 65;
        const res = handlers.selectOption(idx, letter);
        if (typeof res === 'string') replyAndSpeak(res);
        return;
      }

      // True / False
      if (/^(?:select |choose |answer |it is )?true$/.test(norm) && handlers.selectTrueFalse) {
        const res = handlers.selectTrueFalse(true);
        if (typeof res === 'string') replyAndSpeak(res);
        return;
      }
      if (/^(?:select |choose |answer |it is )?false$/.test(norm) && handlers.selectTrueFalse) {
        const res = handlers.selectTrueFalse(false);
        if (typeof res === 'string') replyAndSpeak(res);
        return;
      }

      // 4. Topic / Lesson Actions ("chapter" means "topic")
      if (/\b(mark topic complete|complete topic|mark as complete|finish topic)\b/.test(norm)) {
        if (handlers.markTopicComplete) {
          const res = handlers.markTopicComplete();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(bookmark this|save bookmark|add bookmark|remove bookmark)\b/.test(norm)) {
        if (handlers.bookmarkThis) {
          const res = handlers.bookmarkThis();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(what topics are there|list topics|read topics|list chapters)\b/.test(norm)) {
        if (handlers.listTopics) {
          const res = handlers.listTopics();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(next topic|next chapter)\b/.test(norm)) {
        if (handlers.nextTopic) {
          const res = handlers.nextTopic();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      if (/\b(previous topic|previous chapter|last topic|last chapter)\b/.test(norm)) {
        if (handlers.previousTopic) {
          const res = handlers.previousTopic();
          if (typeof res === 'string') replyAndSpeak(res);
          return;
        }
      }

      // "go to topic five" / "open chapter 3" / "topic 2"
      const topicMatch = norm.match(/\b(?:go to |open |select )?(?:topic|chapter)\s+(.+)$/);
      if (topicMatch && handlers.goToTopic) {
        const rest = topicMatch[1].trim();
        const num = parseSpokenNumber(rest);
        const res = handlers.goToTopic(num, rest);
        if (typeof res === 'string') replyAndSpeak(res);
        return;
      }

      // "open course COM 124" / "open COM 124"
      const courseMatch = norm.match(/\b(?:open|go to|view|select)\s+(?:course\s+)?([a-z]{2,5}\s*\d{3})\b/i)
        || norm.match(/\bopen course\s+(.+)$/i);
      if (courseMatch && handlers.openCourse) {
        const res = handlers.openCourse(courseMatch[1].trim());
        if (typeof res === 'string') replyAndSpeak(res);
        return;
      }

      // 5. Fill-in-the-gap spoken word bank fallback ("put modem", "gap 1 modem", or direct bank word)
      if (handlers.selectWordBankWord) {
        const gapNumMatch = norm.match(/\bgap\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\s+(.+)$/i);
        const gapNum = gapNumMatch ? parseSpokenNumber(gapNumMatch[1]) ?? undefined : undefined;
        const wordCandidate = gapNumMatch ? gapNumMatch[2].trim() : norm.replace(/^(put|fill|choose|select)\s+/i, '').trim();
        const res = handlers.selectWordBankWord(wordCandidate, gapNum);
        if (typeof res === 'string' && res.length > 0) {
          replyAndSpeak(res);
          return;
        }
      }

      // 6. Primary App Navigation
      if (/\b(go home|open home|home page|dashboard)\b/.test(norm)) {
        const res = handlers.goHome?.();
        replyAndSpeak(typeof res === 'string' ? res : 'Opening home dashboard.');
        return;
      }

      if (/\b(open courses|my courses|go to courses|courses)\b/.test(norm)) {
        const res = handlers.openCourses?.();
        replyAndSpeak(typeof res === 'string' ? res : 'Opening courses.');
        return;
      }

      if (/\b(open past questions|past questions|go to past questions)\b/.test(norm)) {
        const res = handlers.openPastQuestions?.();
        replyAndSpeak(typeof res === 'string' ? res : 'Opening past questions.');
        return;
      }

      if (/\b(open timetable|timetable|class schedule|exam timetable)\b/.test(norm)) {
        const res = handlers.openTimetable?.();
        replyAndSpeak(typeof res === 'string' ? res : 'Opening timetable.');
        return;
      }

      if (/\b(open announcements|announcements|notices)\b/.test(norm)) {
        const res = handlers.openAnnouncements?.();
        replyAndSpeak(typeof res === 'string' ? res : 'Opening announcements.');
        return;
      }

      if (/\b(open quizzes|quizzes|my quizzes|open quiz)\b/.test(norm)) {
        const res = handlers.openQuizzes?.();
        replyAndSpeak(typeof res === 'string' ? res : 'Opening quizzes.');
        return;
      }

      if (/^(go back|back|return|previous page)$/.test(norm)) {
        const res = handlers.goBack?.();
        replyAndSpeak(typeof res === 'string' ? res : 'Going back.');
        return;
      }

      // 7. Unrecognized fallback
      replyAndSpeak(VOICE_FALLBACK_TEXT);
    },
    [
      getMergedHandlers,
      replyAndSpeak,
      stopSpeech,
      pauseSpeech,
      resumeSpeech,
      repeatSpeech,
      fasterSpeech,
      slowerSpeech,
      nextParagraph,
      previousParagraph,
      speakBlocks,
      extractVisiblePageBlocks,
      activeBlockIndex,
      activeSourceId
    ]
  );

  // Language fallback order: en-NG -> en-GB -> en-US -> en
  const LANG_CHAIN = ['en-NG', 'en-GB', 'en-US', 'en'];

  const startRecognitionWithLang = useCallback(
    (langIndex: number) => {
      const Ctor = getSpeechRecognitionCtor();
      if (!Ctor) {
        const msg = 'Speech recognition is not supported in this browser. All Read Aloud and large touch buttons still work.';
        setVoiceError(msg);
        replyAndSpeak(msg);
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        const msg = 'You appear to be offline. Voice recognition needs an internet connection on most browsers, but Listen and all large touch buttons still work.';
        setVoiceError(msg);
        replyAndSpeak(msg);
        return;
      }

      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      // Pause active TTS while listening so mic does not capture its own speaker output
      if (isSpeaking) {
        stopSpeech();
      }

      const recognition = new Ctor();
      const targetLang = LANG_CHAIN[langIndex] || 'en';
      recognition.lang = targetLang;
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      let gotResult = false;

      recognition.onstart = () => {
        setIsListening(true);
        setVoiceError(null);
      };

      recognition.onresult = (event: any) => {
        gotResult = true;
        const transcript = event?.results?.[0]?.[0]?.transcript || '';
        setIsListening(false);
        if (transcript.trim()) {
          processVoiceCommand(transcript);
        } else {
          replyAndSpeak(VOICE_FALLBACK_TEXT);
        }
      };

      recognition.onerror = (event: any) => {
        const errCode = event?.error || '';
        if ((errCode === 'language-not-supported' || errCode === 'service-not-allowed') && langIndex + 1 < LANG_CHAIN.length) {
          startRecognitionWithLang(langIndex + 1);
          return;
        }
        setIsListening(false);
        if (errCode === 'not-allowed' || errCode === 'permission-denied') {
          const msg = 'Microphone permission was denied. Please allow microphone access in your browser settings.';
          setVoiceError(msg);
          replyAndSpeak(msg);
        } else if (errCode === 'network') {
          const msg = 'Speech service is unavailable offline or on this network. Listen and touch buttons remain active.';
          setVoiceError(msg);
          replyAndSpeak(msg);
        } else if (errCode === 'no-speech') {
          const msg = 'I did not hear anything. Tap the microphone button and speak clearly.';
          setVoiceError(msg);
          replyAndSpeak(msg);
        } else if (errCode !== 'aborted') {
          const msg = 'Could not hear command clearly. Please try again or use touch buttons.';
          setVoiceError(msg);
          replyAndSpeak(msg);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        if (!gotResult) {
          // handled by onerror or user stop
        }
      };

      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch (err) {
        setIsListening(false);
        const msg = 'Unable to start microphone right now. Please try again.';
        setVoiceError(msg);
        replyAndSpeak(msg);
      }
    },
    [isSpeaking, stopSpeech, processVoiceCommand, replyAndSpeak]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    // Check privacy notice first time microphone is tapped
    let hasSeenPrivacy = false;
    try {
      hasSeenPrivacy = localStorage.getItem(STORAGE_KEY_MIC_PRIVACY) === 'true';
    } catch {
      // ignore
    }
    if (!hasSeenPrivacy) {
      setPrivacyNoticePending(true);
      setLastAssistantReply(MIC_PRIVACY_NOTICE_TEXT);
      speak(MIC_PRIVACY_NOTICE_TEXT);
      return;
    }

    startRecognitionWithLang(0);
  }, [speak, startRecognitionWithLang]);

  const acceptMicPrivacyAndListen = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY_MIC_PRIVACY, 'true');
    } catch {
      // ignore
    }
    setPrivacyNoticePending(false);
    startRecognitionWithLang(0);
  }, [startRecognitionWithLang]);

  const dismissMicPrivacy = useCallback(() => {
    setPrivacyNoticePending(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, stopListening, startListening]);

  const clearVoiceStatus = useCallback(() => {
    setLastTranscript('');
    setLastAssistantReply('');
    setVoiceError(null);
  }, []);

  const cancelPendingConfirmation = useCallback(() => {
    setPendingConfirmation(null);
    replyAndSpeak('Submission cancelled.');
  }, [replyAndSpeak]);

  const enableAccessibilityMode = useCallback(() => {
    updateSettings({
      accessibilityMode: true,
      voiceAssistantEnabled: true,
      readAloudEnabled: true
    });
    replyAndSpeak(
      'Accessibility mode enabled. Voice assistant and read aloud are now active. Tap the microphone button at the bottom centre anytime, or open accessibility options at the top of the page.'
    );
  }, [updateSettings, replyAndSpeak]);

  const resetAccessibilitySettings = useCallback(() => {
    updateSettings(DEFAULT_ACCESSIBILITY_SETTINGS);
  }, [updateSettings]);

  const openSettingsModal = useCallback(() => setSettingsModalOpen(true), []);
  const closeSettingsModal = useCallback(() => setSettingsModalOpen(false), []);

  // Cleanup speech on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        updateSettings,
        enableAccessibilityMode,
        resetAccessibilitySettings,
        settingsModalOpen,
        openSettingsModal,
        closeSettingsModal,
        availableVoices,
        refreshVoices,
        isSpeaking,
        isPaused,
        activeSourceId,
        activeBlockIndex,
        activeSentenceIndex,
        activeSentenceText,
        speak,
        speakBlocks,
        pauseSpeech,
        resumeSpeech,
        stopSpeech,
        repeatSpeech,
        nextParagraph,
        previousParagraph,
        fasterSpeech,
        slowerSpeech,
        isListening,
        speechRecognitionSupported,
        privacyNoticePending,
        acceptMicPrivacyAndListen,
        dismissMicPrivacy,
        startListening,
        stopListening,
        toggleListening,
        lastTranscript,
        lastAssistantReply,
        voiceError,
        clearVoiceStatus,
        processVoiceCommand,
        pendingConfirmation,
        cancelPendingConfirmation,
        registerVoiceHandlers
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = (): AccessibilityContextValue => {
  const ctx = useContext(AccessibilityContext);
  if (!ctx) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return ctx;
};

/**
 * Convenience hook for components to register contextual voice handlers while mounted.
 */
export function useRegisterVoiceHandlers(id: string, handlers: VoiceCommandHandlers) {
  const { registerVoiceHandlers } = useAccessibility();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    return registerVoiceHandlers(id, () => handlersRef.current);
  }, [id, registerVoiceHandlers]);
}
