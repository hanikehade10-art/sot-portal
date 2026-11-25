import React, { useEffect, useRef } from 'react';
import { Accessibility, X } from 'lucide-react';
import { useAccessibility } from '../context/AccessibilityContext';
import { AccessibilitySettingsPanel } from './AccessibilitySettingsPanel';

export const AccessibilitySettingsModal: React.FC = () => {
  const { settingsModalOpen, closeSettingsModal, resetAccessibilitySettings } = useAccessibility();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!settingsModalOpen) return;
    closeBtnRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettingsModal();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsModalOpen, closeSettingsModal]);

  if (!settingsModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-[#050914]/85 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-modal-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#121C36] border-2 border-[#FFC700]/70 shadow-2xl flex flex-col overflow-hidden my-auto">
        <div className="p-4 sm:p-5 border-b border-[#24315A] bg-[#0A1224] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FFC700]/15 border border-[#FFC700]/50 text-[#FFC700] flex items-center justify-center shrink-0">
              <Accessibility className="w-5 h-5" />
            </div>
            <div>
              <h2 id="a11y-modal-title" className="font-heading font-bold text-base sm:text-lg text-[#E6ECFA]">
                Accessibility Options
              </h2>
              <p className="text-xs text-[#9AA8C7]">
                Customize voice assistant, read aloud, contrast, text size, and quiz time.
              </p>
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={closeSettingsModal}
            aria-label="Close accessibility options"
            className="min-h-[48px] min-w-[48px] rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-[#E6ECFA] flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          <AccessibilitySettingsPanel compact />
        </div>

        <div className="p-4 border-t border-[#24315A] bg-[#0A1224] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={resetAccessibilitySettings}
            className="min-h-[48px] px-4 rounded-xl bg-[#121C36] border border-[#24315A] hover:border-[#FFC700] text-xs font-bold text-[#E6ECFA] cursor-pointer"
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={closeSettingsModal}
            className="min-h-[48px] px-6 rounded-xl bg-[#FFC700] hover:bg-[#ffd233] text-[#0A1224] text-sm font-extrabold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
