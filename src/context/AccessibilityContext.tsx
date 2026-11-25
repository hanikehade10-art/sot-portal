import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState
} from 'react';
import { doc } from 'firebase/firestore';
import { db, safeSetDoc } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useSiteSettings } from '../hooks/useSiteSettings';
import {
  AccessibilitySettings,
  SpeechSpeed
} from '../types';
import {
  parseSpokenNumber,
  splitIntoSentences,
  stringSimilarity
} from '../lib/speechUtils';
import {
  getAllowedCommandsForPage,
  getExampleCommandsForPage,
  normalizeSpokenCommand,
  resolveVoiceIntent,
  sanitizePhraseForLogging,
  VoiceCommandId,
  VoiceCourseRef,
  VoiceIntentCandidate,
  VoicePageContext,
  VoiceTopicRef
} from '../lib/voiceIntentEngine';

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = {
  accessibilityMode: false,
  voiceAssistantEnabled: false,
  readAloudEnabled: true,
  textScale: 100,
  highContrast: false,
  reduceMotion: false,
  speechSpeed: 'normal',
  speechVoice: '',
  extendedQuizTime: 1,
  aiVoiceFallbackEnabled: false,
  helpImproveVoiceEnabled: false
};

const STORAGE_KEY_SETTINGS = 'sot_accessibility_settings';
const STORAGE_KEY_MIC_PRIVACY = 'sot_mic_privacy_seen';

export const MIC_PRIVACY_NOTICE_TEXT =
  "Your voice is processed by your browser's speech service to understand commands. The app does not store your voice.";

export interface VoiceCommandHandlers {
  // Context & Catalog Metadata
  getPageContextName?: () => VoicePageContext;
  getAvailableCourses?: () => VoiceCourseRef[];
  getAvailableTopics?: () => VoiceTopicRef[];
  hasWordBankQuestion?: () => boolean;

  // Navigation
  goHome?: () => string | void;
  openCourses?: () => string | void;
  openPastQuestions?: () => string | void;
  openTimetable?: () => string | void;
  openAnnouncements?: () => string | void;
  openQuizzes?: () => string | void;
  goBack?: () => string | void;
  requestLogout?: () => { confirmPrompt: string; onConfirm: () => void } | string | void;

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
  confirmLabel?: string;
  onConfirm: () => void;
}

interface PendingDisambiguation {
  prompt: string;
  options: [VoiceIntentCandidate, VoiceIntentCandidate];
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
  aiFallbackBusy: boolean;
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
  pendingDisambiguation: PendingDisambiguation | null;
  selectDisambiguationOption: (index: 0 | 1) => void;
  cancelDisambiguation: () => void;

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
  const { settings: siteSettings } = useSiteSettings();
  const dailyAiLimit =
    typeof siteSettings.aiDailyLimit === 'number' && siteSettings.aiDailyLimit > 0
      ? siteSettings.aiDailyLimit
      : 60;
  const dailyAiLimitRef = useRef(dailyAiLimit);
  dailyAiLimitRef.current = dailyAiLimit;

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
        aiVoiceFallbackEnabled: Boolean(profile.accessibilitySettings.aiVoiceFallbackEnabled),
        helpImproveVoiceEnabled: Boolean(profile.accessibilitySettings.helpImproveVoiceEnabled),
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
  // VOICE ASSISTANT & NATURAL LANGUAGE COMMAND PROCESSOR
  // -------------------------------------------------------------
  const [isListening, setIsListening] = useState(false);
  const [aiFallbackBusy, setAiFallbackBusy] = useState(false);
  const [privacyNoticePending, setPrivacyNoticePending] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastAssistantReply, setLastAssistantReply] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);
  const [pendingDisambiguation, setPendingDisambiguation] = useState<PendingDisambiguation | null>(null);

  const pendingConfirmRef = useRef<PendingConfirmation | null>(null);
  pendingConfirmRef.current = pendingConfirmation;
  const pendingDisambigRef = useRef<PendingDisambiguation | null>(null);
  pendingDisambigRef.current = pendingDisambiguation;

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

  const inferPageContext = useCallback((handlers: VoiceCommandHandlers): VoicePageContext => {
    const explicit = handlers.getPageContextName?.();
    if (explicit) return explicit;
    if (handlers.readQuestion && handlers.selectOption) return 'quiz-active';
    if (handlers.getNotesBlocks && handlers.nextTopic) return 'lesson';
    if (handlers.goToTopic && handlers.listTopics) return 'course-detail';
    if (handlers.openCourse) return 'courses-list';
    if (handlers.startQuiz) return 'quiz-list';
    return 'dashboard';
  }, []);

  const buildAvailableCommandSet = useCallback((handlers: VoiceCommandHandlers): Set<VoiceCommandId> => {
    const set = new Set<VoiceCommandId>([
      'help',
      'describePage',
      'stopSpeech',
      'pauseSpeech',
      'resumeSpeech',
      'repeatSpeech',
      'fasterSpeech',
      'slowerSpeech',
      'nextParagraph',
      'previousParagraph',
      'readPage',
      'readFromHere'
    ]);

    if (handlers.goHome) set.add('goHome');
    if (handlers.openCourses) set.add('openCourses');
    if (handlers.openPastQuestions) set.add('openPastQuestions');
    if (handlers.openTimetable) set.add('openTimetable');
    if (handlers.openAnnouncements) set.add('openAnnouncements');
    if (handlers.openQuizzes) set.add('openQuizzes');
    if (handlers.goBack) set.add('goBack');
    if (handlers.requestLogout) set.add('logout');
    if (handlers.openCourse) set.add('openCourse');
    if (handlers.goToTopic) set.add('goToTopic');
    if (handlers.nextTopic) set.add('nextTopic');
    if (handlers.previousTopic) set.add('previousTopic');
    if (handlers.listTopics) set.add('listTopics');
    if (handlers.markTopicComplete) set.add('markTopicComplete');
    if (handlers.bookmarkThis) set.add('bookmarkThis');
    if (handlers.getSummaryText) set.add('readSummary');
    if (handlers.getNotesBlocks) set.add('readNotes');
    if (handlers.startQuiz) set.add('startQuiz');
    if (handlers.readQuestion) set.add('readQuestion');
    if (handlers.repeatOptions) set.add('repeatOptions');
    if (handlers.selectOption) set.add('selectOption');
    if (handlers.selectTrueFalse) set.add('selectTrueFalse');
    if (handlers.selectWordBankWord) set.add('selectWordBankWord');
    if (handlers.nextQuestion) set.add('nextQuestion');
    if (handlers.previousQuestion) set.add('previousQuestion');
    if (handlers.howMuchTimeIsLeft) set.add('howMuchTimeIsLeft');
    if (handlers.requestSubmitQuiz) set.add('submitQuiz');

    return set;
  }, []);

  const executeIntentCandidate = useCallback(
    (candidate: VoiceIntentCandidate, handlers: VoiceCommandHandlers) => {
      const sayResult = (res: string | void, fallbackMsg: string) => {
        const msg = typeof res === 'string' && res.trim() ? res.trim() : fallbackMsg;
        replyAndSpeak(msg);
      };

      switch (candidate.commandId) {
        case 'help': {
          const ctx = inferPageContext(handlers);
          const examples = getExampleCommandsForPage(ctx);
          replyAndSpeak(
            `On this screen, try saying: ${examples[0]}, ${examples[1]}, or ${examples[2]}. You can also say go home, open courses, open past questions, open timetable, pause, resume, or stop.`
          );
          return;
        }
        case 'describePage': {
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
        case 'stopSpeech': {
          stopSpeech();
          setLastAssistantReply('Understood: Stopped reading aloud.');
          return;
        }
        case 'pauseSpeech': {
          pauseSpeech();
          setLastAssistantReply('Understood: Paused reading. Say continue or resume to go on.');
          return;
        }
        case 'resumeSpeech': {
          resumeSpeech();
          setLastAssistantReply('Understood: Resumed reading.');
          return;
        }
        case 'repeatSpeech': {
          setLastAssistantReply('Understood: Repeating.');
          repeatSpeech();
          return;
        }
        case 'fasterSpeech': {
          fasterSpeech();
          setLastAssistantReply('Understood: Increased speech speed.');
          return;
        }
        case 'slowerSpeech': {
          slowerSpeech();
          setLastAssistantReply('Understood: Decreased speech speed.');
          return;
        }
        case 'nextParagraph': {
          if (activeQueueRef.current) {
            setLastAssistantReply('Understood: Moving to the next paragraph.');
            nextParagraph();
          } else {
            replyAndSpeak('Nothing is currently playing. Say read the notes or read this page first.');
          }
          return;
        }
        case 'previousParagraph': {
          if (activeQueueRef.current) {
            setLastAssistantReply('Understood: Moving to the previous paragraph.');
            previousParagraph();
          } else {
            replyAndSpeak('Nothing is currently playing. Say read the notes or read this page first.');
          }
          return;
        }
        case 'readSummary': {
          const summary = handlers.getSummaryText?.();
          if (summary) {
            setLastAssistantReply('Understood: Reading the topic summary.');
            speakBlocks('lesson-summary', [summary]);
          } else {
            replyAndSpeak('No summary is available on this screen.');
          }
          return;
        }
        case 'readNotes': {
          const blocks = handlers.getNotesBlocks?.();
          if (blocks && blocks.length > 0) {
            setLastAssistantReply('Understood: Reading lesson notes.');
            speakBlocks('lesson-notes', blocks, 0);
          } else {
            const pageBlocks = handlers.getPageBlocks?.() || extractVisiblePageBlocks();
            if (pageBlocks.length > 0) {
              setLastAssistantReply('Understood: Reading this page.');
              speakBlocks('page-content', pageBlocks, 0);
            } else {
              replyAndSpeak('No lesson notes are open right now.');
            }
          }
          return;
        }
        case 'readPage': {
          const customBlocks = handlers.getPageBlocks?.() || handlers.getNotesBlocks?.();
          const blocks = customBlocks && customBlocks.length > 0 ? customBlocks : extractVisiblePageBlocks();
          if (blocks.length > 0) {
            setLastAssistantReply('Understood: Reading this page.');
            speakBlocks('page-content', blocks, 0);
          } else {
            replyAndSpeak('Nothing readable was found on this page.');
          }
          return;
        }
        case 'readFromHere': {
          const blocks = handlers.getNotesBlocks?.() || handlers.getPageBlocks?.() || extractVisiblePageBlocks();
          if (blocks.length > 0) {
            const startAt = Math.max(0, activeBlockIndex >= 0 ? activeBlockIndex : 0);
            setLastAssistantReply(`Understood: Reading from paragraph ${startAt + 1}.`);
            speakBlocks(activeSourceId || 'lesson-notes', blocks, startAt);
          } else {
            replyAndSpeak('No content is currently available to read from.');
          }
          return;
        }
        case 'startQuiz': {
          if (handlers.startQuiz) {
            sayResult(handlers.startQuiz(), 'Opening the quiz.');
          } else if (handlers.openQuizzes) {
            sayResult(handlers.openQuizzes(), 'Opening Quizzes.');
          }
          return;
        }
        case 'readQuestion': {
          sayResult(handlers.readQuestion?.(), 'Reading the current question.');
          return;
        }
        case 'repeatOptions': {
          sayResult(handlers.repeatOptions?.(), 'Repeating the options.');
          return;
        }
        case 'selectOption': {
          const letter = (candidate.argument || 'A').toUpperCase().slice(0, 1);
          const idx = letter.charCodeAt(0) - 65;
          sayResult(handlers.selectOption?.(idx, letter), `Selecting option ${letter}.`);
          return;
        }
        case 'selectTrueFalse': {
          const isTrue = String(candidate.argument || 'true').toLowerCase() === 'true';
          sayResult(handlers.selectTrueFalse?.(isTrue), `Selecting ${isTrue ? 'True' : 'False'}.`);
          return;
        }
        case 'selectWordBankWord': {
          const rawArg = String(candidate.argument || '');
          const parts = rawArg.split('|');
          const gapNum = parts.length === 2 && parts[0] ? parseInt(parts[0], 10) : undefined;
          const word = parts.length === 2 ? parts[1] : rawArg;
          sayResult(
            handlers.selectWordBankWord?.(word, Number.isNaN(gapNum as any) ? undefined : gapNum),
            `Picking word ${word}.`
          );
          return;
        }
        case 'nextQuestion': {
          sayResult(handlers.nextQuestion?.(), 'Moving to the next question.');
          return;
        }
        case 'previousQuestion': {
          sayResult(handlers.previousQuestion?.(), 'Moving to the previous question.');
          return;
        }
        case 'howMuchTimeIsLeft': {
          sayResult(handlers.howMuchTimeIsLeft?.(), 'Checking remaining time.');
          return;
        }
        case 'submitQuiz': {
          const result = handlers.requestSubmitQuiz?.();
          if (result && typeof result === 'object' && 'confirmPrompt' in result) {
            setPendingConfirmation({
              prompt: result.confirmPrompt,
              confirmLabel: 'Yes, Submit Quiz',
              onConfirm: result.onConfirm
            });
            replyAndSpeak(result.confirmPrompt);
          } else {
            sayResult(result, 'No active quiz is ready to submit.');
          }
          return;
        }
        case 'markTopicComplete': {
          sayResult(handlers.markTopicComplete?.(), 'Updated topic completion status.');
          return;
        }
        case 'bookmarkThis': {
          sayResult(handlers.bookmarkThis?.(), 'Updated bookmark.');
          return;
        }
        case 'listTopics': {
          sayResult(handlers.listTopics?.(), 'Listing topics.');
          return;
        }
        case 'nextTopic': {
          sayResult(handlers.nextTopic?.(), 'Opening the next topic.');
          return;
        }
        case 'previousTopic': {
          sayResult(handlers.previousTopic?.(), 'Opening the previous topic.');
          return;
        }
        case 'goToTopic': {
          const arg = String(candidate.argument || '').trim();
          const num = parseSpokenNumber(arg);
          sayResult(handlers.goToTopic?.(num, arg), `Opening topic ${arg}.`);
          return;
        }
        case 'openCourse': {
          const arg = String(candidate.argument || '').trim();
          sayResult(handlers.openCourse?.(arg), `Opening course ${arg}.`);
          return;
        }
        case 'goHome': {
          sayResult(handlers.goHome?.(), 'Opening Student Home.');
          return;
        }
        case 'openCourses': {
          sayResult(handlers.openCourses?.(), 'Opening Courses.');
          return;
        }
        case 'openPastQuestions': {
          sayResult(handlers.openPastQuestions?.(), 'Opening Past Questions.');
          return;
        }
        case 'openTimetable': {
          sayResult(handlers.openTimetable?.(), 'Opening Timetable.');
          return;
        }
        case 'openAnnouncements': {
          sayResult(handlers.openAnnouncements?.(), 'Opening Announcements.');
          return;
        }
        case 'openQuizzes': {
          sayResult(handlers.openQuizzes?.(), 'Opening Quizzes.');
          return;
        }
        case 'goBack': {
          sayResult(handlers.goBack?.(), 'Going back.');
          return;
        }
        case 'logout': {
          const result = handlers.requestLogout?.();
          if (result && typeof result === 'object' && 'confirmPrompt' in result) {
            setPendingConfirmation({
              prompt: result.confirmPrompt,
              confirmLabel: 'Yes, Log Out',
              onConfirm: result.onConfirm
            });
            replyAndSpeak(result.confirmPrompt);
          } else {
            sayResult(result, 'Log out is only available while signed in.');
          }
          return;
        }
      }
    },
    [
      inferPageContext,
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

  const logUnrecognizedPhraseIfOptedIn = useCallback(
    (rawPhrase: string, normalizedCompact: string, pageContext: VoicePageContext) => {
      if (!settingsRef.current.helpImproveVoiceEnabled) return;
      if (!user?.uid) return;
      const cleanPhrase = sanitizePhraseForLogging(rawPhrase);
      if (!cleanPhrase) return;
      const docId = `vp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      // Strictly NO audio, NO user names, NO emails, NO uid stored
      safeSetDoc(doc(db, 'unrecognizedVoicePhrases', docId), {
        phrase: cleanPhrase,
        normalizedPhrase: normalizedCompact.slice(0, 280),
        pageContext,
        createdAt: new Date().toISOString()
      }).catch(() => {
        // fail silently so learning flow is never interrupted
      });
    },
    [user?.uid]
  );

  const speakPageExamplesFallback = useCallback(
    (pageContext: VoicePageContext) => {
      const examples = getExampleCommandsForPage(pageContext);
      replyAndSpeak(
        `I didn't match that command. Try saying: "${examples[0]}", "${examples[1]}", or "${examples[2]}".`
      );
    },
    [replyAndSpeak]
  );

  const processVoiceCommand = useCallback(
    (rawText: string) => {
      const cleaned = rawText.trim();
      if (!cleaned) return;
      setLastTranscript(cleaned);
      const handlers = getMergedHandlers();
      const norm = normalizeSpokenCommand(cleaned);
      const low = norm.lowercaseClean;

      // 0a. Pending Spoken Confirmation ("Did you mean ...?" or "Confirm quiz submission")
      if (pendingConfirmRef.current) {
        if (/^(?:yes|yeah|yep|confirm|submit|sure|proceed|ok|okay|correct|do it|go ahead)\b/.test(low) || /\b(?:yes|confirm|correct)\b/.test(low)) {
          const action = pendingConfirmRef.current.onConfirm;
          setPendingConfirmation(null);
          action();
          return;
        }
        if (/\b(?:no|nah|cancel|wait|stop|dont|don t|never mind)\b/.test(low)) {
          setPendingConfirmation(null);
          replyAndSpeak('Cancelled.');
          return;
        }
        replyAndSpeak('Please say yes to confirm, or no to cancel.');
        return;
      }

      // 0b. Pending 2-Option Disambiguation ("Did you mean X or Y?")
      if (pendingDisambigRef.current) {
        const [optA, optB] = pendingDisambigRef.current.options;
        if (/\b(?:no|neither|cancel|none|stop)\b/.test(low)) {
          setPendingDisambiguation(null);
          replyAndSpeak('Cancelled. Please say your command again.');
          return;
        }
        if (/\b(?:first|one|1|a|option a|option 1)\b/.test(low)) {
          setPendingDisambiguation(null);
          executeIntentCandidate(optA, handlers);
          return;
        }
        if (/\b(?:second|two|2|b|option b|option 2)\b/.test(low)) {
          setPendingDisambiguation(null);
          executeIntentCandidate(optB, handlers);
          return;
        }
        // Check phrase similarity against either candidate label
        const simA = stringSimilarity(norm.compact, optA.label.toLowerCase());
        const simB = stringSimilarity(norm.compact, optB.label.toLowerCase());
        if (simA > simB && simA >= 0.45) {
          setPendingDisambiguation(null);
          executeIntentCandidate(optA, handlers);
          return;
        }
        if (simB > simA && simB >= 0.45) {
          setPendingDisambiguation(null);
          executeIntentCandidate(optB, handlers);
          return;
        }
        setPendingDisambiguation(null);
        // Fall through to parse as fresh command if neither chosen!
      }

      const pageContext = inferPageContext(handlers);
      const availableCommands = buildAvailableCommandSet(handlers);
      const availableCourses = handlers.getAvailableCourses?.() || [];
      const availableTopics = handlers.getAvailableTopics?.() || [];
      const hasWordBankQuestion = handlers.hasWordBankQuestion?.() || false;

      const resolution = resolveVoiceIntent({
        transcript: cleaned,
        pageContext,
        isSpeaking,
        hasWordBankQuestion,
        availableCommands,
        availableCourses,
        availableTopics
      });

      if (resolution.status === 'matched') {
        executeIntentCandidate(resolution.candidate, handlers);
        return;
      }

      if (resolution.status === 'confirm-single') {
        const cand = resolution.candidate;
        setPendingConfirmation({
          prompt: `Did you mean ${cand.label}? Say yes or no.`,
          confirmLabel: `Yes, ${cand.label}`,
          onConfirm: () => executeIntentCandidate(cand, handlers)
        });
        replyAndSpeak(`Did you mean ${cand.label}? Say yes or no.`);
        return;
      }

      if (resolution.status === 'disambiguate-two') {
        const [candA, candB] = resolution.candidates;
        const prompt = `Did you mean ${candA.label} or ${candB.label}?`;
        setPendingDisambiguation({
          prompt,
          options: [candA, candB]
        });
        replyAndSpeak(prompt);
        return;
      }

      // Unmatched deterministically -> try Optional AI Fallback if opted in & online
      const allowedSpecs = getAllowedCommandsForPage(pageContext, availableCommands);
      if (
        settingsRef.current.aiVoiceFallbackEnabled &&
        (typeof navigator === 'undefined' || navigator.onLine !== false) &&
        allowedSpecs.length > 0
      ) {
        setAiFallbackBusy(true);
        setLastAssistantReply('Checking what you meant...');
        fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'voice-intent',
            message: cleaned.slice(0, 300),
            pageContext,
            allowedCommands: allowedSpecs.map((c) => ({
              id: c.id,
              label: c.label,
              acceptsArgument: Boolean(c.acceptsArgument)
            })),
            courses: availableCourses.slice(0, 40).map((c) => ({ code: c.code, title: c.title })),
            topics: availableTopics.slice(0, 30).map((t, i) => ({ number: i + 1, title: t.title })),
            clientUid: user?.uid,
            maxDailyLimit: dailyAiLimitRef.current
          })
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }
            return res.json();
          })
          .then((data: { commandId?: string; argument?: string }) => {
            const matchedSpec = allowedSpecs.find((c) => c.id === data?.commandId);
            if (!matchedSpec) {
              logUnrecognizedPhraseIfOptedIn(cleaned, resolution.normalized.compact, pageContext);
              speakPageExamplesFallback(pageContext);
              return;
            }
            const aiCandidate: VoiceIntentCandidate = {
              commandId: matchedSpec.id,
              label: matchedSpec.label,
              score: 0.8,
              argument: data.argument || undefined,
              requiresConfirmation: matchedSpec.requiresConfirmation
            };
            // Always require confirmation for submitQuiz, logout, or delete
            if (aiCandidate.requiresConfirmation) {
              executeIntentCandidate(aiCandidate, handlers);
              return;
            }
            executeIntentCandidate(aiCandidate, handlers);
          })
          .catch(() => {
            logUnrecognizedPhraseIfOptedIn(cleaned, resolution.normalized.compact, pageContext);
            speakPageExamplesFallback(pageContext);
          })
          .finally(() => {
            setAiFallbackBusy(false);
          });
        return;
      }

      // Deterministic unmatched & AI fallback disabled -> log if opted in, then read 3 page examples
      logUnrecognizedPhraseIfOptedIn(cleaned, resolution.normalized.compact, pageContext);
      speakPageExamplesFallback(pageContext);
    },
    [
      getMergedHandlers,
      inferPageContext,
      buildAvailableCommandSet,
      isSpeaking,
      executeIntentCandidate,
      replyAndSpeak,
      user?.uid,
      logUnrecognizedPhraseIfOptedIn,
      speakPageExamplesFallback
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
          const handlers = getMergedHandlers();
          speakPageExamplesFallback(inferPageContext(handlers));
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
      } catch {
        setIsListening(false);
        const msg = 'Unable to start microphone right now. Please try again.';
        setVoiceError(msg);
        replyAndSpeak(msg);
      }
    },
    [isSpeaking, stopSpeech, processVoiceCommand, replyAndSpeak, getMergedHandlers, inferPageContext, speakPageExamplesFallback]
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
    setPendingConfirmation(null);
    setPendingDisambiguation(null);
  }, []);

  const cancelPendingConfirmation = useCallback(() => {
    setPendingConfirmation(null);
    replyAndSpeak('Cancelled.');
  }, [replyAndSpeak]);

  const selectDisambiguationOption = useCallback(
    (index: 0 | 1) => {
      const current = pendingDisambigRef.current;
      if (!current) return;
      const chosen = current.options[index];
      setPendingDisambiguation(null);
      executeIntentCandidate(chosen, getMergedHandlers());
    },
    [executeIntentCandidate, getMergedHandlers]
  );

  const cancelDisambiguation = useCallback(() => {
    setPendingDisambiguation(null);
    replyAndSpeak('Cancelled. Please say your command again.');
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
        aiFallbackBusy,
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
        pendingDisambiguation,
        selectDisambiguationOption,
        cancelDisambiguation,
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
