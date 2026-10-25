import React from 'react';
import { WhatsAppIcon } from './WhatsAppIcon';

interface WhatsAppChannelButtonProps {
  url?: string;
  variant?: 'solid' | 'outline' | 'banner';
  className?: string;
}

export const WhatsAppChannelButton: React.FC<WhatsAppChannelButtonProps> = ({
  url,
  variant = 'solid',
  className = ''
}) => {
  if (!url || !url.trim()) return null;

  const cleanUrl = url.trim();

  if (variant === 'banner') {
    return (
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-[#25D366]/20 via-[#25D366]/10 to-[#121C36] border border-[#25D366]/50 hover:border-[#25D366] transition-all duration-200 group shadow-[0_4px_20px_rgba(37,211,102,0.15)] ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(37,211,102,0.4)]">
            <WhatsAppIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-[#E6ECFA] group-hover:text-white transition-colors">
              Join our SOT WhatsApp Channel
            </div>
            <div className="text-[11px] text-[#9AA8C7]">
              Get real-time timetable alerts, announcements, and study updates.
            </div>
          </div>
        </div>
        <span className="shrink-0 px-3 py-1.5 rounded-lg bg-[#25D366] text-white text-xs font-bold hover:bg-[#20ba5a] shadow-sm">
          Join
        </span>
      </a>
    );
  }

  if (variant === 'outline') {
    return (
      <a
        href={cleanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#121C36] border border-[#25D366]/60 text-[#25D366] hover:bg-[#25D366]/15 hover:border-[#25D366] text-xs font-bold transition-all shadow-[0_0_15px_rgba(37,211,102,0.1)] cursor-pointer ${className}`}
      >
        <WhatsAppIcon className="w-4 h-4 text-[#25D366] shrink-0" />
        <span>Join our SOT WhatsApp Channel</span>
      </a>
    );
  }

  return (
    <a
      href={cleanUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white hover:bg-[#20ba5a] transition-all duration-200 shadow-[0_4px_20px_rgba(37,211,102,0.35)] hover:scale-[1.02] active:scale-[0.98] text-xs font-bold cursor-pointer ${className}`}
    >
      <WhatsAppIcon className="w-4 h-4 text-white shrink-0" />
      <span>Join our SOT WhatsApp Channel</span>
    </a>
  );
};
