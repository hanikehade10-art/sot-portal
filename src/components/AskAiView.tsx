import React, { useState, useRef, useEffect } from 'react';
import { useAiChat } from '../context/AiChatContext';
import { useAuth } from '../context/AuthContext';
import { FormattedAiMessage } from './FormattedAiMessage';
import {
  Sparkles,
  RotateCcw,
  Send,
  Bot,
  User,
  GraduationCap,
  HelpCircle,
  AlertCircle,
  Zap
} from 'lucide-react';

const STUDY_QUICK_CHIPS = [
  'Explain a core concept in simple steps',
  'Give me a practical polytechnic workshop example',
  'Quiz me on high-yield exam topics',
  'Summarize lecture notes I paste in'
];

const PORTAL_QUICK_CHIPS = [
  'How do I complete Step 2 registration?',
  'What 6 departments are in the School of Technology?',
  'How do I reset my password?',
  'How do I submit an enquiry or complaint?'
];

interface AskAiViewProps {
  initialPrompt?: string | null;
  onClearInitialPrompt?: () => void;
}

export const AskAiView: React.FC<AskAiViewProps> = ({
  initialPrompt,
  onClearInitialPrompt
}) => {
  const { profile } = useAuth();
  const {
    mode,
    setMode,
    messages,
    isTyping,
    errorMessage,
    remainingToday,
    isDailyLimitReached,
    sendMessage,
    startNewChat,
    setIsAskAiPageActive
  } = useAiChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-fill prompt when arriving from a topic or lesson
  useEffect(() => {
    if (initialPrompt) {
      setInput(initialPrompt);
      setMode('study');
      onClearInitialPrompt?.();
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [initialPrompt, onClearInitialPrompt, setMode]);

  // Set Ask AI page active to hide the floating button
  useEffect(() => {
    setIsAskAiPageActive(true);
    return () => {
      setIsAskAiPageActive(false);
    };
  }, [setIsAskAiPageActive]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isTyping) return;
    setInput('');
    await sendMessage(text);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const studentDept = profile?.department || 'School of Technology';
  // Show suggestions only initially before conversation starts (messages.length <= 1)
  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[500px] rounded-xl bg-[#0D162B] border border-[#24315A] shadow-2xl overflow-hidden">
      
      {/* COMPACT SINGLE-ROW HEADER */}
      <div className="px-3.5 py-2.5 bg-[#121C36] border-b border-[#24315A] flex flex-wrap items-center justify-between gap-2 shrink-0">
        
        {/* Title */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2F52FF] flex items-center justify-center text-white border border-[#FFC700]/30 shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC700]" />
          </div>
          <div>
            <h2 className="font-heading font-bold text-sm text-[#E6ECFA] leading-tight">
              Ask AI
            </h2>
            <span className="text-[10px] text-[#9AA8C7] truncate max-w-[150px] sm:max-w-xs block leading-tight">
              {mode === 'study' ? studentDept : 'Portal Knowledge'}
            </span>
          </div>
        </div>

        {/* Mode Switch, Quota Counter, and New Chat */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher */}
          <div className="bg-[#0A1224] p-0.5 rounded-lg border border-[#24315A] flex items-center">
            <button
              onClick={() => setMode('study')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                mode === 'study'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <GraduationCap className="w-3 h-3 text-[#FFC700]" />
              <span className="hidden sm:inline">Study Helper</span>
              <span className="sm:hidden">Study</span>
            </button>

            <button
              onClick={() => setMode('portal')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-all cursor-pointer ${
                mode === 'portal'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <HelpCircle className="w-3 h-3 text-[#FFC700]" />
              <span className="hidden sm:inline">Portal Help</span>
              <span className="sm:hidden">Portal</span>
            </button>
          </div>

          {/* Daily Quota Counter */}
          <div className="px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs text-[#9AA8C7] flex items-center gap-1">
            <Zap className="w-3 h-3 text-[#FFC700]" />
            <span className="text-[#E6ECFA] font-bold">{remainingToday}</span>
            <span className="text-[11px]">left today</span>
          </div>

          {/* New Chat Button */}
          <button
            onClick={startNewChat}
            title="Start new conversation"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-xs font-medium text-[#9AA8C7] hover:text-[#FFC700] hover:border-[#FFC700]/50 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">New chat</span>
          </button>
        </div>

      </div>

      {/* MESSAGES STREAM - FILLS ALL REMAINING SCREEN HEIGHT AND SCROLLS */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-5 space-y-3.5">
        {messages.map((m) => {
          const isStudent = m.sender === 'student';
          return (
            <div
              key={m.id}
              className={`flex gap-2.5 max-w-3xl ${isStudent ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                  isStudent
                    ? 'bg-[#2F52FF] text-white shadow-[0_0_10px_rgba(47,82,255,0.3)]'
                    : 'bg-[#121C36] border border-[#FFC700]/40 text-[#FFC700]'
                }`}
              >
                {isStudent ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-0.5 max-w-[88%]">
                <div
                  className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm leading-relaxed ${
                    isStudent
                      ? 'bg-[#2F52FF] text-white rounded-tr-none shadow-md whitespace-pre-wrap'
                      : 'bg-[#121C36] text-[#E6ECFA] border border-[#24315A] rounded-tl-none shadow-md'
                  }`}
                >
                  {isStudent ? (
                    m.text
                  ) : (
                    <FormattedAiMessage content={m.text} />
                  )}
                </div>
                <div
                  className={`text-[10px] text-[#9AA8C7]/60 px-1 ${
                    isStudent ? 'text-right' : 'text-left'
                  }`}
                >
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2.5 mr-auto max-w-sm">
            <div className="w-7 h-7 rounded-lg bg-[#121C36] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700] shrink-0">
              <Bot className="w-3.5 h-3.5 animate-pulse" />
            </div>
            <div className="px-3.5 py-2 rounded-xl rounded-tl-none bg-[#121C36] border border-[#24315A] text-xs text-[#9AA8C7] flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Assistant is typing...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* SUGGESTIONS CHIPS (Disappear after the first message) */}
      {showSuggestions && (
        <div className="px-3.5 py-1.5 bg-[#0A1224]/70 border-t border-[#24315A] flex items-center gap-1.5 overflow-x-auto shrink-0">
          <span className="text-[10px] font-bold text-[#FFC700] uppercase tracking-wider shrink-0 mr-1">
            Suggestions:
          </span>
          {(mode === 'study' ? STUDY_QUICK_CHIPS : PORTAL_QUICK_CHIPS).map((chip, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(chip)}
              disabled={isTyping || isDailyLimitReached}
              className="px-2.5 py-1 rounded-lg bg-[#121C36] border border-[#24315A] text-[11px] text-[#9AA8C7] hover:text-[#E6ECFA] hover:border-[#2F52FF] transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ERROR NOTICE */}
      {errorMessage && (
        <div className="px-3.5 py-1.5 bg-rose-950/70 border-t border-rose-500/50 text-xs text-rose-200 flex items-center gap-2 shrink-0">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* TEXT BOX PINNED AT THE BOTTOM */}
      <div className="p-3 bg-[#121C36] border-t border-[#24315A] shrink-0">
        <div className="relative flex items-center gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'study'
                ? `Ask questions, paste notes, or request a quiz for ${studentDept}...`
                : 'Ask about departments, registration, or helpdesk...'
            }
            disabled={isDailyLimitReached || isTyping}
            className="flex-1 max-h-28 min-h-[40px] py-2 pl-3 pr-10 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF] resize-none leading-relaxed transition-all disabled:opacity-50"
          />

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping || isDailyLimitReached}
            className="w-10 h-10 rounded-xl bg-[#2F52FF] text-white flex items-center justify-center hover:bg-[#2545df] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_10px_rgba(47,82,255,0.3)] shrink-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

        <p className="text-[10px] text-[#9AA8C7]/70 text-center mt-1">
          AI can make mistakes. Verify important academic dates.
        </p>
      </div>

    </div>
  );
};
