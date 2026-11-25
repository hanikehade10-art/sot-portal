import React from 'react';
import { useAccessibility } from '../context/AccessibilityContext';
import { ExtendedQuizTimeMultiplier, SpeechSpeed } from '../types';
import {
  Accessibility,
  Volume2,
  Mic,
  Eye,
  Clock,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  Gauge,
  Brain,
  MessageSquarePlus
} from 'lucide-react';

interface AccessibilitySettingsPanelProps {
  compact?: boolean;
}

export const AccessibilitySettingsPanel: React.FC<AccessibilitySettingsPanelProps> = ({
  compact = false
}) => {
  const {
    settings,
    updateSettings,
    resetAccessibilitySettings,
    availableVoices,
    speak
  } = useAccessibility();

  const toggleSwitch = (
    label: string,
    description: string,
    checked: boolean,
    onChange: (next: boolean) => void,
    icon: React.ReactNode
  ) => (
    <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A]">
      <div className="flex items-start gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#121C36] border border-[#24315A] text-[#FFC700] flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm text-[#E6ECFA]">{label}</div>
          <p className="text-xs text-[#9AA8C7] leading-snug mt-0.5">{description}</p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={`${label}: ${checked ? 'On' : 'Off'}`}
        onClick={() => onChange(!checked)}
        className={`min-h-[48px] min-w-[76px] px-3 rounded-xl font-bold text-xs border transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1.5 ${
          checked
            ? 'bg-[#2F52FF] border-[#60A5FA] text-white'
            : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-white'
        }`}
      >
        <CheckCircle2 className={`w-4 h-4 ${checked ? 'opacity-100' : 'opacity-30'}`} />
        <span>{checked ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  );

  return (
    <section
      aria-label="Accessibility Settings"
      className={compact ? 'space-y-3' : 'p-4 sm:p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-4'}
    >
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#24315A]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FFC700]/15 border border-[#FFC700]/40 text-[#FFC700] flex items-center justify-center shrink-0">
              <Accessibility className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base text-[#E6ECFA]">
                Accessibility Options
              </h3>
              <p className="text-xs text-[#9AA8C7]">
                Saved to your account so your setup applies on every device.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetAccessibilitySettings}
            className="min-h-[48px] px-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] hover:border-[#FFC700] text-xs font-semibold text-[#E6ECFA] flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 text-[#FFC700]" />
            <span>Reset defaults</span>
          </button>
        </div>
      )}

      {/* Primary Feature Toggles */}
      <div className="space-y-2.5">
        {toggleSwitch(
          'Accessibility Mode',
          'Enables larger 48px touch targets, automatic quiz question reading, spoken timer alerts, and full keyboard/screen-reader focus support.',
          settings.accessibilityMode,
          (val) =>
            updateSettings({
              accessibilityMode: val,
              ...(val ? { voiceAssistantEnabled: true, readAloudEnabled: true } : {})
            }),
          <Accessibility className="w-5 h-5" />
        )}

        {toggleSwitch(
          'Voice Assistant',
          'Show the floating microphone button at the bottom centre for hands-free navigation, reading, and quiz answers.',
          settings.voiceAssistantEnabled,
          (val) => updateSettings({ voiceAssistantEnabled: val }),
          <Mic className="w-5 h-5" />
        )}

        {toggleSwitch(
          'Read Aloud (Listen)',
          'Show Listen buttons on lessons, summaries, questions, and quiz results with live sentence highlighting.',
          settings.readAloudEnabled,
          (val) => updateSettings({ readAloudEnabled: val }),
          <Volume2 className="w-5 h-5" />
        )}

        {toggleSwitch(
          'High Contrast Theme',
          'Sharpens backgrounds, borders, and text contrast while preserving the dark navy and yellow palette.',
          settings.highContrast,
          (val) => updateSettings({ highContrast: val }),
          <Eye className="w-5 h-5" />
        )}

        {toggleSwitch(
          'Reduce Motion',
          'Turns off page transitions, slide animations, and floating cues for comfortable viewing.',
          settings.reduceMotion,
          (val) => updateSettings({ reduceMotion: val }),
          <Sparkles className="w-5 h-5" />
        )}

        {toggleSwitch(
          'AI Voice Fallback (Optional)',
          'When off, commands are matched offline on your device only. When on, unmatched phrases send only your spoken words and this page\'s command list to Gemini AI and count toward your daily AI limit.',
          Boolean(settings.aiVoiceFallbackEnabled),
          (val) => updateSettings({ aiVoiceFallbackEnabled: val }),
          <Brain className="w-5 h-5" />
        )}

        {toggleSwitch(
          'Help Improve Voice Assistant',
          'Opt-in only: if a spoken command is not understood, save only the unrecognized text and page name (never audio, names, or IDs) so portal admins can add more natural phrases.',
          Boolean(settings.helpImproveVoiceEnabled),
          (val) => updateSettings({ helpImproveVoiceEnabled: val }),
          <MessageSquarePlus className="w-5 h-5" />
        )}
      </div>

      {/* Text Size A- / A+ up to 200% */}
      <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-semibold text-sm text-[#E6ECFA]">Text Size</div>
            <p className="text-xs text-[#9AA8C7]">Scale text across the portal up to 200%.</p>
          </div>
          <span
            className="px-3 py-1 rounded-lg bg-[#121C36] border border-[#FFC700]/40 text-sm font-bold text-[#FFC700]"
            aria-live="polite"
          >
            {settings.textScale}%
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => updateSettings({ textScale: Math.max(100, settings.textScale - 15) })}
            disabled={settings.textScale <= 100}
            aria-label="Decrease text size"
            className="min-h-[48px] px-3 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-sm font-extrabold text-[#E6ECFA] disabled:opacity-40 cursor-pointer"
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ textScale: 100 })}
            aria-label="Reset text size to 100 percent"
            className="min-h-[48px] px-3 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#2F52FF] text-xs font-bold text-[#9AA8C7] hover:text-white cursor-pointer"
          >
            100%
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ textScale: Math.min(200, settings.textScale + 15) })}
            disabled={settings.textScale >= 200}
            aria-label="Increase text size"
            className="min-h-[48px] px-3 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-base font-extrabold text-[#FFC700] disabled:opacity-40 cursor-pointer"
          >
            A+
          </button>
        </div>
      </div>

      {/* Speech Speed & Speech Voice */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#E6ECFA]">
            <Gauge className="w-4 h-4 text-[#FFC700]" />
            <span>Speech Speed</span>
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Speech Speed">
            {(['slow', 'normal', 'fast'] as SpeechSpeed[]).map((spd) => {
              const active = settings.speechSpeed === spd;
              return (
                <button
                  key={spd}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateSettings({ speechSpeed: spd })}
                  className={`min-h-[48px] rounded-xl text-xs font-bold capitalize border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#2F52FF] border-[#60A5FA] text-white'
                      : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-white'
                  }`}
                >
                  {spd}
                </button>
              );
            })}
          </div>
        </div>

        {/* Extended Quiz Time */}
        <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm text-[#E6ECFA]">
            <Clock className="w-4 h-4 text-[#FFC700]" />
            <span>Extended Quiz Time</span>
          </div>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Extended Quiz Time">
            {([
              { label: 'Standard (1x)', value: 1 as ExtendedQuizTimeMultiplier },
              { label: '1.5x Time', value: 1.5 as ExtendedQuizTimeMultiplier },
              { label: '2x Time', value: 2 as ExtendedQuizTimeMultiplier }
            ]).map((opt) => {
              const active = settings.extendedQuizTime === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateSettings({ extendedQuizTime: opt.value })}
                  className={`min-h-[48px] px-2 rounded-xl text-xs font-bold border cursor-pointer transition-colors ${
                    active
                      ? 'bg-[#FFC700] border-[#FFC700] text-[#0A1224]'
                      : 'bg-[#121C36] border-[#24315A] text-[#9AA8C7] hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Speech Voice Selector */}
      <div className="p-3.5 rounded-xl bg-[#0A1224] border border-[#24315A] space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="a11y-speech-voice-select" className="font-semibold text-sm text-[#E6ECFA]">
            Speech Voice
          </label>
          <button
            type="button"
            onClick={() =>
              speak('Hello from the School of Technology Portal. This is your selected reading voice.')
            }
            className="min-h-[48px] px-3.5 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-xs font-bold text-[#FFC700] flex items-center gap-1.5 cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            <span>Test Voice</span>
          </button>
        </div>

        <select
          id="a11y-speech-voice-select"
          value={settings.speechVoice}
          onChange={(e) => updateSettings({ speechVoice: e.target.value })}
          className="w-full min-h-[48px] px-3 py-2 rounded-xl bg-[#121C36] border border-[#24315A] text-sm text-[#E6ECFA] focus:outline-none focus:border-[#FFC700]"
        >
          <option value="">Default Device Voice (English Nigeria / English)</option>
          {availableVoices.map((voice) => (
            <option key={voice.voiceURI} value={voice.voiceURI}>
              {voice.name} ({voice.lang})
            </option>
          ))}
        </select>
      </div>
    </section>
  );
};
