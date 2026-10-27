import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Share2, PlusSquare, X, Smartphone, CheckCircle2 } from 'lucide-react';

interface PWAInstallRowProps {
  className?: string;
  compact?: boolean;
}

export const PWAInstallRow: React.FC<PWAInstallRowProps> = ({ className = '', compact = false }) => {
  const { isStandalone, isIOS, hasDeferredPrompt, triggerInstall } = usePWAInstall();
  const [showIOSSheet, setShowIOSSheet] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);

  // Hide completely if already running in standalone mode (already installed as PWA)
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSSheet(true);
      return;
    }

    const res = await triggerInstall();
    if (res === 'accepted') {
      setInstallSuccess(true);
      setTimeout(() => setInstallSuccess(false), 4000);
    } else if (res === 'ios_manual') {
      setShowIOSSheet(true);
    }
  };

  return (
    <>
      <div
        className={`flex items-center justify-between gap-3 p-3 rounded-xl bg-[#0F1E36] border border-[#1F2C4C] transition-all hover:border-[#2F52FF]/60 ${className}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#24315A] flex items-center justify-center text-[#FFC700] shrink-0">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#E6ECFA] truncate">
              Install SOT App
            </p>
            {!compact && (
              <p className="text-[11px] text-[#9AA8C7] truncate">
                Fast offline access & home screen icon
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          type="button"
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#2F52FF] hover:bg-[#2544DD] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-[0_0_12px_rgba(47,82,255,0.25)]"
        >
          <Download className="w-3.5 h-3.5 text-[#FFC700]" />
          <span>Install</span>
        </button>
      </div>

      {installSuccess && (
        <div className="mt-2 p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>SOT app installed! You can now launch it directly from your home screen.</span>
        </div>
      )}

      {/* iOS Safari Install Guide Bottom Sheet */}
      {showIOSSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-xs p-3">
          <div className="w-full max-w-md bg-[#0F1E36] border border-[#24315A] rounded-2xl p-5 shadow-2xl space-y-4 animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F2C4C]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#121C36] border border-[#FFC700]/50 flex items-center justify-center text-[#FFC700]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-sm text-[#E6ECFA]">Install SOT on iPhone / iPad</h4>
                  <p className="text-[11px] text-[#9AA8C7]">Add to your home screen in 2 simple taps</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSSheet(false)}
                className="p-1 rounded-lg text-[#9AA8C7] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#121C36] border border-[#1F2C4C]">
                <div className="w-7 h-7 rounded-lg bg-[#2F52FF]/20 border border-[#2F52FF]/40 text-[#2F52FF] flex items-center justify-center shrink-0 font-bold text-xs">
                  1
                </div>
                <div className="space-y-0.5">
                  <p className="text-[#E6ECFA] font-semibold flex items-center gap-1.5">
                    Tap the Share icon
                    <Share2 className="w-3.5 h-3.5 text-[#2F52FF] inline" />
                  </p>
                  <p className="text-[11px] text-[#9AA8C7]">
                    Located at the bottom center or top right of Safari browser.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[#121C36] border border-[#1F2C4C]">
                <div className="w-7 h-7 rounded-lg bg-[#FFC700]/20 border border-[#FFC700]/40 text-[#FFC700] flex items-center justify-center shrink-0 font-bold text-xs">
                  2
                </div>
                <div className="space-y-0.5">
                  <p className="text-[#E6ECFA] font-semibold flex items-center gap-1.5">
                    Choose &ldquo;Add to Home Screen&rdquo;
                    <PlusSquare className="w-3.5 h-3.5 text-[#FFC700] inline" />
                  </p>
                  <p className="text-[11px] text-[#9AA8C7]">
                    Scroll down the share sheet and tap &ldquo;Add to Home Screen&rdquo;.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSSheet(false)}
              className="w-full py-2.5 rounded-xl bg-[#2F52FF] hover:bg-[#2544DD] text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
