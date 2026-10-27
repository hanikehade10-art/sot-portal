import React from 'react';
import { WhatsAppIcon } from './WhatsAppIcon';

interface WhatsAppChannelButtonProps {
  url?: string;
  variant?: 'solid' | 'outline' | 'banner' | 'card';
  className?: string;
  showText?: boolean;
}

export const WhatsAppChannelButton: React.FC<WhatsAppChannelButtonProps> = ({
  url,
  variant = 'solid',
  className = '',
  showText = true
}) => {
  if (!url || !url.trim()) return null;

  const cleanUrl = url.trim();
  const descriptionText = "Get timetable updates, exam dates, past questions and study tips. Join the SOT channel.";

  if (variant === 'banner' || variant === 'card') {
    return (
      <div className={`p-3.5 sm:p-4 rounded-xl bg-[#121C36] border border-[#25D366]/40 hover:border-[#25D366] transition-all shadow-[0_2px_15px_rgba(37,211,102,0.12)] ${className}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(37,211,102,0.35)] mt-0.5">
              <WhatsAppIcon className="w-4 h-4" />
            </div>
            <div className="space-y-0.5">
              <div className="text-xs sm:text-sm font-bold text-[#E6ECFA] flex items-center gap-2">
                <span>Join our SOT WhatsApp Channel</span>
                <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30">
                  LIVE UPDATES
                </span>
              </div>
              <p className="text-[11px] text-[#9AA8C7] leading-relaxed">
                {descriptionText}
              </p>
            </div>
          </div>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-[#25D366] hover:bg-[#20ba5a] text-white text-xs font-bold transition-all shadow-[0_0_10px_rgba(37,211,102,0.3)] cursor-pointer"
          >
            <WhatsAppIcon className="w-3.5 h-3.5 text-white" />
            <span>Join Channel</span>
          </a>
        </div>
      </div>
    );
  }

  if (variant === 'outline') {
    return (
      <div className={`space-y-1.5 ${className}`}>
        <a
          href={cleanUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121C36] border border-[#25D366]/60 text-[#25D366] hover:bg-[#25D366]/15 hover:border-[#25D366] text-xs font-bold transition-all shadow-[0_0_15px_rgba(37,211,102,0.1)] cursor-pointer"
        >
          <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0" />
          <span>Join our SOT WhatsApp Channel</span>
        </a>
        {showText && (
          <p className="text-[11px] text-[#9AA8C7] max-w-sm">
            {descriptionText}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white hover:bg-[#20ba5a] transition-all duration-200 shadow-[0_4px_16px_rgba(37,211,102,0.3)] hover:scale-[1.01] active:scale-[0.99] text-xs font-bold cursor-pointer"
      >
        <WhatsAppIcon className="w-4 h-4 text-white shrink-0" />
        <span>Join our SOT WhatsApp Channel</span>
      </a>
      {showText && (
        <p className="text-[11px] text-[#9AA8C7] max-w-sm">
          {descriptionText}
        </p>
      )}
    </div>
  );
};
