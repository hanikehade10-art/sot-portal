import React, { useState, useRef, useEffect } from 'react';
import { useAiChat } from '../context/AiChatContext';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  X,
  Send,
  Sparkles,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Shield,
  Bot,
  RotateCcw,
  GraduationCap,
  Building2,
  Zap
} from 'lucide-react';

const PORTAL_QUICK_REPLIES = [
  'How do I sign up?',
  'What departments are there?',
  'I forgot my password',
  'How do I contact the faculty?'
];

const STUDY_QUICK_REPLIES = [
  'Explain a concept in simple steps',
  'Give me a practical example',
  'Quiz me on my department',
  'Summarize lecture notes'
];

export const Chatbot: React.FC = () => {
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
    floatingOpen,
    setFloatingOpen
  } = useAiChat();

  const [input, setInput] = useState('');
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    if (floatingOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, floatingOpen]);

  // Handle open/close
  const handleToggleOpen = () => {
    const nextState = !floatingOpen;
    setFloatingOpen(nextState);
    if (nextState) {
      setHasUnread(false);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || isTyping) return;
    setInput('');
    await sendMessage(queryText);
    if (!floatingOpen) {
      setHasUnread(true);
    }
  };

  const studentDept = profile?.department || 'School of Technology';

  return (
    <>
      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={handleToggleOpen}
          aria-label="Open SOT Assistant Chat"
          className="relative w-14 h-14 rounded-full bg-[#2F52FF] text-white flex items-center justify-center shadow-[0_4px_25px_rgba(47,82,255,0.45)] hover:bg-[#2545df] hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-[#FFC700]/40 group"
        >
          {floatingOpen ? (
            <X className="w-6 h-6 transition-transform group-hover:rotate-90 duration-200" />
          ) : (
            <>
              <Bot className="w-6 h-6 text-white" />
              {/* Signal Yellow Notification Dot */}
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FFC700] border-2 border-[#0A1224] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0A1224] animate-pulse" />
              </span>
            </>
          )}

          {/* Tooltip on hover if closed */}
          {!floatingOpen && (
            <span className="hidden md:block absolute right-16 px-3 py-1.5 rounded-lg bg-[#121C36] border border-[#24315A] text-xs font-semibold text-[#E6ECFA] whitespace-nowrap shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Ask AI: <strong className="text-[#FFC700]">Study Helper & Portal Help</strong>
            </span>
          )}
        </button>
      </div>

      {/* CHAT WINDOW */}
      {floatingOpen && (
        <div
          role="dialog"
          aria-label="SOT Assistant Chat Window"
          className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-[440px] sm:h-[640px] sm:max-h-[85vh] bg-[#0A1224] sm:border sm:border-[#24315A] sm:rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.85)] z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* HEADER */}
          <div className="bg-[#121C36] px-4 py-3 border-b border-[#24315A] flex flex-col gap-2 shrink-0">
            
            {/* Top row: Brand & Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-[#2F52FF] flex items-center justify-center text-white border border-[#FFC700]/30 shadow-[0_0_12px_rgba(47,82,255,0.4)]">
                    <Sparkles className="w-4 h-4 text-[#FFC700]" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#121C36]" />
                </div>

                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-display font-bold text-sm text-[#E6ECFA]">
                      Ask AI
                    </h3>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#0A1224] text-[#FFC700] border border-[#24315A]">
                      SOT
                    </span>
                  </div>
                  <p className="text-[10px] text-[#9AA8C7] truncate max-w-[170px]">
                    {mode === 'study' ? `Tailored for ${studentDept}` : 'Portal knowledge & FAQs'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Daily Quota Tag */}
                <div className="px-2 py-0.5 rounded-md bg-[#0A1224] border border-[#24315A] text-[10px] font-mono text-[#9AA8C7] flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#FFC700]" />
                  <span>{remainingToday}/30</span>
                </div>

                {/* New chat button */}
                <button
                  onClick={startNewChat}
                  title="New chat"
                  className="p-1.5 rounded-lg text-[#9AA8C7] hover:text-[#FFC700] hover:bg-[#0A1224] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {/* Close window */}
                <button
                  onClick={() => setFloatingOpen(false)}
                  title="Close chat"
                  className="p-1.5 rounded-lg text-[#9AA8C7] hover:text-[#E6ECFA] hover:bg-[#0A1224] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bottom row: Mode Switcher Tabs */}
            <div className="grid grid-cols-2 gap-1.5 bg-[#0A1224] p-1 rounded-xl border border-[#24315A]">
              <button
                onClick={() => setMode('study')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'study'
                    ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                    : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#FFC700]" />
                <span>Study Helper</span>
              </button>

              <button
                onClick={() => setMode('portal')}
                className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'portal'
                    ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                    : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5 text-[#FFC700]" />
                <span>Portal Help</span>
              </button>
            </div>

          </div>

          {/* MESSAGES SCROLL AREA */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#0A1224] selection:bg-[#2F52FF] selection:text-white">
            {messages.map((msg) => {
              const isStudent = msg.sender === 'student';
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isStudent ? 'justify-end' : 'justify-start'}`}
                >
                  {!isStudent && (
                    <div className="w-7 h-7 rounded-lg bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] shrink-0 mb-1">
                      <Bot className="w-4 h-4 text-[#FFC700]" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${
                      isStudent
                        ? 'bg-[#2F52FF] text-white rounded-br-none shadow-[0_2px_12px_rgba(47,82,255,0.25)]'
                        : 'bg-[#121C36] border border-[#24315A] text-[#E6ECFA] rounded-bl-none shadow-[0_2px_12px_rgba(0,0,0,0.3)]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {/* TYPING INDICATOR */}
            {isTyping && (
              <div className="flex items-end gap-2 justify-start">
                <div className="w-7 h-7 rounded-lg bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] shrink-0 mb-1">
                  <Bot className="w-4 h-4 text-[#FFC700]" />
                </div>
                <div className="bg-[#121C36] border border-[#24315A] px-3.5 py-2 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce" />
                  <span className="text-[11px] text-[#9AA8C7] ml-2">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* QUICK-REPLY BUTTONS */}
          <div className="bg-[#121C36] border-t border-[#24315A] px-3 py-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(mode === 'study' ? STUDY_QUICK_REPLIES : PORTAL_QUICK_REPLIES).map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={isTyping || isDailyLimitReached}
                  className="px-2.5 py-1 rounded-lg bg-[#0A1224] border border-[#24315A] text-[11px] text-[#E6ECFA] hover:text-[#FFC700] hover:border-[#FFC700]/50 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* ERROR BANNER */}
          {errorMessage && (
            <div className="bg-rose-950/70 border-t border-rose-500/40 px-3 py-1.5 text-[11px] text-rose-200 flex items-center gap-1.5 shrink-0">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
          )}

          {/* INPUT FORM */}
          <div className="p-3 bg-[#0A1224] border-t border-[#24315A] shrink-0 space-y-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isTyping || isDailyLimitReached}
                placeholder={
                  isDailyLimitReached
                    ? 'Daily limit of 30 messages reached...'
                    : mode === 'study'
                    ? `Ask academic question for ${studentDept}...`
                    : 'Ask about departments, sign up, or portal...'
                }
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs text-[#E6ECFA] placeholder-[#9AA8C7]/60 focus:outline-none focus:border-[#2F52FF] focus:ring-1 focus:ring-[#2F52FF] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!input.trim() || isTyping || isDailyLimitReached}
                aria-label="Send message"
                className="w-10 h-10 rounded-xl bg-[#2F52FF] text-white flex items-center justify-center hover:bg-[#2545df] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.3)] shrink-0"
              >
                {isTyping ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>

            {/* Mandatory AI Disclaimer */}
            <p className="text-[10px] text-[#9AA8C7]/70 text-center font-medium">
              AI can make mistakes. Check important information.
            </p>
          </div>

        </div>
      )}
    </>
  );
};
