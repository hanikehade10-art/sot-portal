import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Square,
  HelpCircle,
  X,
  ShieldCheck,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import {
  MIC_PRIVACY_NOTICE_TEXT,
  useAccessibility
} from '../context/AccessibilityContext';

export const VoiceAssistantOverlay: React.FC = () => {
  const {
    settings,
    isListening,
    isSpeaking,
    toggleListening,
    stopSpeech,
    privacyNoticePending,
    acceptMicPrivacyAndListen,
    dismissMicPrivacy,
    lastTranscript,
    lastAssistantReply,
    voiceError,
    clearVoiceStatus,
    pendingConfirmation,
    cancelPendingConfirmation
  } = useAccessibility();

  const [showCommandsHelp, setShowCommandsHelp] = useState(false);

  const isVisible = settings.voiceAssistantEnabled;
  if (!isVisible && !privacyNoticePending) {
    return null;
  }

  const hasStatusBanner =
    Boolean(lastTranscript || lastAssistantReply || voiceError || isListening || pendingConfirmation);

  return (
    <>
      {/* First-Tap Microphone Privacy Notice Dialog */}
      {privacyNoticePending && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-[#050914]/85 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mic-privacy-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#121C36] border-2 border-[#FFC700] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#FFC700]/15 border border-[#FFC700]/50 text-[#FFC700] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h2 id="mic-privacy-title" className="font-heading font-bold text-base text-[#E6ECFA]">
                  Voice Assistant Privacy Notice
                </h2>
                <p className="text-sm text-[#E6ECFA] leading-relaxed mt-2">
                  {MIC_PRIVACY_NOTICE_TEXT}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={dismissMicPrivacy}
                className="min-h-[48px] px-4 rounded-xl bg-[#0A1224] border border-[#24315A] text-sm font-semibold text-[#E6ECFA] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={acceptMicPrivacyAndListen}
                autoFocus
                className="min-h-[48px] px-4 rounded-xl bg-[#FFC700] hover:bg-[#ffd233] text-[#0A1224] text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
              >
                <Mic className="w-4 h-4" />
                <span>Continue &amp; Listen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Command Help Sheet */}
      {showCommandsHelp && (
        <div
          className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-3 sm:p-5 bg-[#050914]/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="voice-help-title"
        >
          <div className="w-full max-w-lg max-h-[82vh] rounded-2xl bg-[#121C36] border border-[#24315A] shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#24315A] bg-[#0A1224] flex items-center justify-between">
              <h2 id="voice-help-title" className="font-heading font-bold text-base text-[#FFC700]">
                Voice Commands Guide
              </h2>
              <button
                type="button"
                onClick={() => setShowCommandsHelp(false)}
                aria-label="Close voice commands guide"
                className="min-h-[48px] min-w-[48px] rounded-xl bg-[#121C36] border border-[#24315A] text-[#E6ECFA] flex items-center justify-center cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 text-xs sm:text-sm text-[#E6ECFA]">
              <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1">
                <div className="font-bold text-[#FFC700]">Navigation</div>
                <p className="text-[#9AA8C7]">
                  &ldquo;Go home&rdquo;, &ldquo;Open courses&rdquo;, &ldquo;Open past questions&rdquo;, &ldquo;Open timetable&rdquo;, &ldquo;Open announcements&rdquo;, &ldquo;Open quizzes&rdquo;, &ldquo;Go back&rdquo;
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1">
                <div className="font-bold text-[#FFC700]">Courses &amp; Lessons</div>
                <p className="text-[#9AA8C7]">
                  &ldquo;Open course COM 124&rdquo;, &ldquo;Go to topic five&rdquo;, &ldquo;Go to chapter five&rdquo;, &ldquo;Next topic&rdquo;, &ldquo;Previous topic&rdquo;, &ldquo;What topics are there&rdquo;, &ldquo;Mark topic complete&rdquo;, &ldquo;Bookmark this&rdquo;
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1">
                <div className="font-bold text-[#FFC700]">Reading Aloud</div>
                <p className="text-[#9AA8C7]">
                  &ldquo;Read this page&rdquo;, &ldquo;Read from here&rdquo;, &ldquo;Read the summary&rdquo;, &ldquo;Read the notes&rdquo;, &ldquo;Pause&rdquo;, &ldquo;Resume&rdquo;, &ldquo;Stop&rdquo;, &ldquo;Repeat&rdquo;, &ldquo;Faster&rdquo;, &ldquo;Slower&rdquo;, &ldquo;Next paragraph&rdquo;, &ldquo;Previous paragraph&rdquo;
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1">
                <div className="font-bold text-[#FFC700]">Quizzes</div>
                <p className="text-[#9AA8C7]">
                  &ldquo;Start quiz&rdquo;, &ldquo;Read the question&rdquo;, &ldquo;Repeat the options&rdquo;, &ldquo;Option B&rdquo;, &ldquo;True&rdquo;, &ldquo;False&rdquo;, &ldquo;Next question&rdquo;, &ldquo;Previous question&rdquo;, &ldquo;How much time is left&rdquo;, &ldquo;Submit quiz&rdquo;
                </p>
              </div>
              <div className="p-3 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-1">
                <div className="font-bold text-[#FFC700]">Help</div>
                <p className="text-[#9AA8C7]">
                  &ldquo;What can I say&rdquo;, &ldquo;What is on this page&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spoken & Written Status Live Region Panel (above floating mic) */}
      {hasStatusBanner && (
        <div
          className="fixed bottom-40 md:bottom-24 left-1/2 -translate-x-1/2 z-[88] w-[calc(100%-1.5rem)] max-w-md"
          role="region"
          aria-label="Voice Assistant Response"
        >
          <div
            aria-live="assertive"
            aria-atomic="true"
            className="rounded-2xl bg-[#0A1224]/95 border-2 border-[#2F52FF] p-3.5 shadow-2xl space-y-2 backdrop-blur-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FFC700]">
                {isListening ? (
                  <>
                    <Mic className="w-4 h-4 animate-pulse" />
                    <span>Listening (English Nigeria)... Speak your command</span>
                  </>
                ) : voiceError ? (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    <span className="text-rose-300">Voice Assistant Notice</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Voice Assistant</span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={clearVoiceStatus}
                aria-label="Dismiss voice assistant message"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-[#121C36] text-[#9AA8C7] hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {lastTranscript && (
              <p className="text-xs text-[#9AA8C7]">
                You said: <strong className="text-[#E6ECFA]">&ldquo;{lastTranscript}&rdquo;</strong>
              </p>
            )}

            {(voiceError || lastAssistantReply) && (
              <p className="text-sm text-[#FFFFFF] leading-snug font-medium">
                {voiceError || lastAssistantReply}
              </p>
            )}

            {pendingConfirmation && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const fn = pendingConfirmation.onConfirm;
                    cancelPendingConfirmation();
                    fn();
                  }}
                  className="min-h-[48px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Yes, Submit</span>
                </button>
                <button
                  type="button"
                  onClick={cancelPendingConfirmation}
                  className="min-h-[48px] px-3 rounded-xl bg-[#121C36] border border-[#24315A] text-xs font-bold text-[#E6ECFA] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Large Floating Bottom-Centre Microphone Dock */}
      <div
        className="fixed bottom-20 md:bottom-5 left-1/2 -translate-x-1/2 z-[89] flex items-center gap-2.5"
        role="region"
        aria-label="Voice Assistant Controls"
      >
        {/* Commands Help Button */}
        <button
          type="button"
          onClick={() => setShowCommandsHelp(true)}
          aria-label="What can I say - Open voice command guide"
          title="Voice commands guide"
          className="min-h-[48px] min-w-[48px] rounded-full bg-[#121C36] border-2 border-[#24315A] hover:border-[#FFC700] text-[#E6ECFA] flex items-center justify-center shadow-lg cursor-pointer"
        >
          <HelpCircle className="w-5 h-5 text-[#FFC700]" />
        </button>

        {/* Primary Floating Microphone Button (>= 60px touch target) */}
        <button
          type="button"
          onClick={toggleListening}
          aria-label={isListening ? 'Stop voice listening' : 'Tap once to speak a voice command'}
          aria-pressed={isListening}
          className={`min-h-[60px] min-w-[60px] px-5 rounded-full font-extrabold text-sm flex items-center justify-center gap-2 border-2 shadow-[0_8px_28px_rgba(0,0,0,0.65)] transition-transform cursor-pointer ${
            isListening
              ? 'bg-[#FFC700] border-white text-[#0A1224] scale-105'
              : 'bg-[#2F52FF] border-[#FFC700] text-white hover:bg-[#2545df]'
          }`}
        >
          {isListening ? (
            <>
              <MicOff className="w-6 h-6" />
              <span>Listening...</span>
            </>
          ) : (
            <>
              <Mic className="w-6 h-6 text-[#FFC700]" />
              <span>Voice</span>
            </>
          )}
        </button>

        {/* Quick Stop Speech Button if Reading */}
        {isSpeaking && (
          <button
            type="button"
            onClick={stopSpeech}
            aria-label="Stop speaking aloud"
            title="Stop reading aloud"
            className="min-h-[48px] min-w-[48px] rounded-full bg-rose-700 hover:bg-rose-600 border-2 border-rose-300 text-white flex items-center justify-center shadow-lg cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
          </button>
        )}
      </div>
    </>
  );
};
