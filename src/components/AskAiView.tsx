import React, { useState, useRef, useEffect } from 'react';
import { useAiChat } from '../context/AiChatContext';
import { useAuth } from '../context/AuthContext';
import { AiChatMode } from '../types';
import {
  Sparkles,
  BookOpen,
  HelpCircle,
  RotateCcw,
  Send,
  Bot,
  User,
  GraduationCap,
  Building2,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  FileText,
  Clock,
  ShieldCheck,
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
  'What 7 departments are in the School of Technology?',
  'How do I reset my password?',
  'How do I submit an enquiry or complaint?'
];

export const AskAiView: React.FC = () => {
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
    startNewChat
  } = useAiChat();

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[580px] rounded-2xl bg-[#0D162B] border border-[#24315A] shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden">
      
      {/* TOP HEADER & MODE CONTROLS */}
      <div className="p-4 sm:p-5 bg-[#121C36] border-b border-[#24315A] flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Title & Department Context */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2F52FF] to-[#FFC700] p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(47,82,255,0.35)]">
            <div className="w-full h-full bg-[#0A1224] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#FFC700]" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-lg text-[#E6ECFA]">
                Ask AI Assistant
              </h2>
              <span className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#2F52FF]/20 text-[#2F52FF] border border-[#2F52FF]/40">
                Gemini Powered
              </span>
            </div>
            <p className="text-xs text-[#9AA8C7] flex items-center gap-1.5 mt-0.5">
              <span>Department Context:</span>
              <strong className="text-[#FFC700]">{studentDept}</strong>
            </p>
          </div>
        </div>

        {/* Mode Switcher & Stats */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Mode Switcher Tabs */}
          <div className="bg-[#0A1224] p-1 rounded-xl border border-[#24315A] flex items-center">
            <button
              onClick={() => setMode('study')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'study'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Study Helper</span>
            </button>

            <button
              onClick={() => setMode('portal')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'portal'
                  ? 'bg-[#2F52FF] text-white shadow-[0_0_15px_rgba(47,82,255,0.4)]'
                  : 'text-[#9AA8C7] hover:text-[#E6ECFA]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Portal Help</span>
            </button>
          </div>

          {/* Daily Quota Indicator */}
          <div className="px-3 py-1.5 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs font-mono text-[#9AA8C7] flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="text-[#E6ECFA] font-bold">{remainingToday}</span>
            <span>/ 30 daily</span>
          </div>

          {/* New Chat Button */}
          <button
            onClick={startNewChat}
            title="Start fresh conversation"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#121C36] border border-[#24315A] text-xs font-medium text-[#9AA8C7] hover:text-[#E6ECFA] hover:border-[#FFC700]/50 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#FFC700]" />
            <span className="hidden sm:inline">New chat</span>
          </button>

        </div>

      </div>

      {/* MODE INTRO BANNER */}
      <div className="px-5 py-2.5 bg-[#0A1224]/70 border-b border-[#24315A] text-xs flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#9AA8C7]">
          {mode === 'study' ? (
            <>
              <Lightbulb className="w-4 h-4 text-[#FFC700] shrink-0" />
              <span>
                <strong>Study Helper Mode:</strong> Explaining topics, quizzing, and breaking down notes tailored to <strong>{studentDept}</strong>.
              </span>
            </>
          ) : (
            <>
              <Building2 className="w-4 h-4 text-[#2F52FF] shrink-0" />
              <span>
                <strong>Portal Help Mode:</strong> Answering questions about the 7 departments, account registration, announcements, and helpdesk support.
              </span>
            </>
          )}
        </div>
        <span className="hidden md:inline text-[11px] text-[#9AA8C7]/60 font-mono">
          Session history only
        </span>
      </div>

      {/* MESSAGES STREAM */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((m) => {
          const isStudent = m.sender === 'student';
          return (
            <div
              key={m.id}
              className={`flex gap-3 max-w-3xl ${isStudent ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                  isStudent
                    ? 'bg-[#2F52FF] text-white shadow-[0_0_12px_rgba(47,82,255,0.4)]'
                    : 'bg-[#121C36] border border-[#FFC700]/40 text-[#FFC700] shadow-[0_0_12px_rgba(255,199,0,0.15)]'
                }`}
              >
                {isStudent ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble */}
              <div className="space-y-1">
                <div
                  className={`px-4 py-3 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    isStudent
                      ? 'bg-[#2F52FF] text-white rounded-tr-none shadow-[0_2px_15px_rgba(47,82,255,0.25)]'
                      : 'bg-[#121C36] text-[#E6ECFA] border border-[#24315A] rounded-tl-none shadow-[0_2px_15px_rgba(0,0,0,0.25)]'
                  }`}
                >
                  {m.text}
                </div>
                <div
                  className={`text-[10px] text-[#9AA8C7]/60 font-mono px-1 ${
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
          <div className="flex items-center gap-3 mr-auto max-w-sm">
            <div className="w-8 h-8 rounded-xl bg-[#121C36] border border-[#FFC700]/40 flex items-center justify-center text-[#FFC700] shrink-0">
              <Bot className="w-4 h-4 animate-pulse" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-[#121C36] border border-[#24315A] text-xs text-[#9AA8C7] flex items-center gap-2">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFC700] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>Assistant is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* QUICK SUGGESTION PROMPTS */}
      <div className="px-4 sm:px-6 py-2 bg-[#0A1224]/50 border-t border-[#24315A] flex flex-wrap items-center gap-2 overflow-x-auto">
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

      {/* ERROR NOTICE (e.g. rate limit) */}
      {errorMessage && (
        <div className="px-5 py-2 bg-rose-950/60 border-t border-rose-500/50 text-xs text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* INPUT BAR */}
      <div className="p-3 sm:p-4 bg-[#121C36] border-t border-[#24315A]">
        <div className="relative flex items-center gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'study'
                ? `Ask any academic question, paste lecture notes, or request a quiz for ${studentDept}...`
                : 'Ask about departments, sign-up, announcements, or password reset...'
            }
            disabled={isDailyLimitReached || isTyping}
            className="flex-1 max-h-32 min-h-[44px] py-2.5 pl-4 pr-12 rounded-xl bg-[#0A1224] border border-[#24315A] text-xs sm:text-sm text-[#E6ECFA] placeholder-[#9AA8C7]/50 focus:outline-none focus:border-[#2F52FF] focus:ring-1 focus:ring-[#2F52FF] resize-none leading-relaxed transition-all disabled:opacity-50"
          />

          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping || isDailyLimitReached}
            className="w-11 h-11 rounded-xl bg-[#2F52FF] text-white flex items-center justify-center hover:bg-[#2545df] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_15px_rgba(47,82,255,0.3)] shrink-0 cursor-pointer"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Mandatory AI Disclaimer */}
        <p className="text-[11px] text-[#9AA8C7]/70 text-center mt-2 font-medium tracking-wide">
          AI can make mistakes. Check important information.
        </p>
      </div>

    </div>
  );
};
