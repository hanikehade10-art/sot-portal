import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ChatMessage, AiChatMode, FaqItem } from '../types';
import { useAuth } from './AuthContext';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

const STORAGE_SESSION_CHAT = 'sot_ask_ai_session_messages';
const STORAGE_DAILY_TIMESTAMPS = 'sot_ask_ai_daily_timestamps';
const DAILY_LIMIT_MAX = 30;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const INITIAL_PORTAL_MESSAGE: ChatMessage = {
  id: 'init-portal',
  sender: 'assistant',
  text: "Hi! I'm SOT Assistant (Portal Help). Ask me about the departments, sign-up, announcements, or how to use this portal.",
  timestamp: Date.now(),
  mode: 'portal'
};

export const INITIAL_STUDY_MESSAGE: ChatMessage = {
  id: 'init-study',
  sender: 'assistant',
  text: "Hi! I'm your SOT Study Helper. What topic are you studying today? You can ask me to explain a concept, give practical examples, quiz you, or summarize lecture notes.",
  timestamp: Date.now(),
  mode: 'study'
};

interface AiChatContextType {
  mode: AiChatMode;
  setMode: (mode: AiChatMode) => void;
  messages: ChatMessage[];
  isTyping: boolean;
  errorMessage: string | null;
  setErrorMessage: (msg: string | null) => void;
  remainingToday: number;
  isDailyLimitReached: boolean;
  sendMessage: (text: string) => Promise<void>;
  startNewChat: () => void;
  faqs: FaqItem[];
  floatingOpen: boolean;
  setFloatingOpen: (open: boolean) => void;
  openFloatingWithMode: (targetMode: AiChatMode) => void;
  isAskAiPageActive: boolean;
  setIsAskAiPageActive: (active: boolean) => void;
}

const AiChatContext = createContext<AiChatContextType | undefined>(undefined);

export const AiChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [mode, setModeState] = useState<AiChatMode>('study');
  const [floatingOpen, setFloatingOpen] = useState(false);
  const [isAskAiPageActive, setIsAskAiPageActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  // Load session messages (session only, not database)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_SESSION_CHAT);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [INITIAL_STUDY_MESSAGE];
  });

  // Daily rate limiting state (30 messages per day per student)
  const [dailyTimestamps, setDailyTimestamps] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_DAILY_TIMESTAMPS);
      if (saved) {
        const now = Date.now();
        const parsed: number[] = JSON.parse(saved);
        return parsed.filter(ts => now - ts < ONE_DAY_MS);
      }
    } catch {
      // ignore
    }
    return [];
  });

  // Sync messages to sessionStorage (current session only)
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_SESSION_CHAT, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Load FAQs from Firestore for Portal Help knowledge
  useEffect(() => {
    const fetchFaqs = async () => {
      try {
        const snap = await getDocs(collection(db, 'faqs'));
        const list: FaqItem[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.question && data.answer) {
            list.push({ id: d.id, question: data.question, answer: data.answer });
          }
        });
        setFaqs(list);
      } catch (err) {
        console.warn('FAQ fetch for AI assistant:', err);
      }
    };
    fetchFaqs();
  }, []);

  // Compute daily limit remaining
  const now = Date.now();
  const validTimestamps = dailyTimestamps.filter(ts => now - ts < ONE_DAY_MS);
  const remainingToday = Math.max(0, DAILY_LIMIT_MAX - validTimestamps.length);
  const isDailyLimitReached = remainingToday === 0;

  // Change mode
  const setMode = (newMode: AiChatMode) => {
    setModeState(newMode);
    setErrorMessage(null);
  };

  // Start new chat (clears conversation history in current session)
  const startNewChat = () => {
    const initialMsg = mode === 'study' ? INITIAL_STUDY_MESSAGE : INITIAL_PORTAL_MESSAGE;
    setMessages([initialMsg]);
    setErrorMessage(null);
    try {
      sessionStorage.setItem(STORAGE_SESSION_CHAT, JSON.stringify([initialMsg]));
    } catch {
      // ignore
    }
  };

  const openFloatingWithMode = (targetMode: AiChatMode) => {
    setMode(targetMode);
    setFloatingOpen(true);
  };

  // Send message
  const sendMessage = async (text: string) => {
    const cleanText = text.trim();
    if (!cleanText || isTyping) return;

    if (isDailyLimitReached) {
      setErrorMessage("You've reached your daily limit of 30 AI messages. You're doing great studying today! Please come back tomorrow or take a well-deserved break.");
      return;
    }

    setErrorMessage(null);

    // Capture prior history turns BEFORE appending current message
    const priorHistory = messages.slice(-8).map(m => ({ sender: m.sender, text: m.text }));

    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'student',
      text: cleanText,
      timestamp: Date.now(),
      mode
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Latest knowledge refresh if in portal mode
    let currentFaqs = faqs;
    if (mode === 'portal') {
      try {
        const snap = await getDocs(collection(db, 'faqs'));
        const list: FaqItem[] = [];
        snap.forEach(d => {
          const data = d.data();
          if (data.question && data.answer) {
            list.push({ id: d.id, question: data.question, answer: data.answer });
          }
        });
        if (list.length > 0) currentFaqs = list;
      } catch {
        // use cached
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          history: priorHistory,
          faqs: currentFaqs.map(f => ({ question: f.question, answer: f.answer })),
          clientUid: user?.uid,
          mode,
          department: profile?.department,
          studentName: profile?.fullName || user?.displayName
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || (res.status === 429
          ? "You've reached your daily limit of 30 AI messages. Please come back tomorrow!"
          : "AI is unavailable, try again.");

        setErrorMessage(errMsg);

        // Never show canned welcome message on failure; show real error
        const errBubble: ChatMessage = {
          id: 'bot-err-' + Date.now(),
          sender: 'assistant',
          text: `⚠️ ${errMsg}`,
          timestamp: Date.now(),
          mode
        };
        setMessages(prev => [...prev, errBubble]);
        // Do NOT count failed messages against daily limit of 30
        return;
      }

      const data = await res.json();
      if (!data.reply || typeof data.reply !== 'string' || !data.reply.trim()) {
        const errMsg = "AI returned an empty reply. Please try again.";
        setErrorMessage(errMsg);
        const errBubble: ChatMessage = {
          id: 'bot-err-' + Date.now(),
          sender: 'assistant',
          text: `⚠️ ${errMsg}`,
          timestamp: Date.now(),
          mode
        };
        setMessages(prev => [...prev, errBubble]);
        return;
      }

      const botReply: ChatMessage = {
        id: 'bot-' + Date.now(),
        sender: 'assistant',
        text: data.reply.trim(),
        timestamp: Date.now(),
        mode
      };
      setMessages(prev => [...prev, botReply]);

      // ONLY count successful responses against the 30 daily message limit
      const updatedTimestamps = [...validTimestamps, Date.now()];
      setDailyTimestamps(updatedTimestamps);
      try {
        localStorage.setItem(STORAGE_DAILY_TIMESTAMPS, JSON.stringify(updatedTimestamps));
      } catch {
        // ignore
      }
    } catch (err: any) {
      console.error('AI chat network failure:', err);
      const errMsg = err?.message || 'AI is unavailable, try again.';
      setErrorMessage(errMsg);
      // Visible error message instead of fake fallback
      const errorReply: ChatMessage = {
        id: 'bot-err-' + Date.now(),
        sender: 'assistant',
        text: `⚠️ AI is unavailable, try again. (${errMsg})`,
        timestamp: Date.now(),
        mode
      };
      setMessages(prev => [...prev, errorReply]);
      // Do NOT count failed messages against daily limit of 30
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <AiChatContext.Provider
      value={{
        mode,
        setMode,
        messages,
        isTyping,
        errorMessage,
        setErrorMessage,
        remainingToday,
        isDailyLimitReached,
        sendMessage,
        startNewChat,
        faqs,
        floatingOpen,
        setFloatingOpen,
        openFloatingWithMode,
        isAskAiPageActive,
        setIsAskAiPageActive
      }}
    >
      {children}
    </AiChatContext.Provider>
  );
};

export const useAiChat = () => {
  const context = useContext(AiChatContext);
  if (!context) throw new Error('useAiChat must be used within an AiChatProvider');
  return context;
};
