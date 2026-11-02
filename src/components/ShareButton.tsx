import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import { shareItem, ShareOptions } from '../utils/shareItem';

interface ShareButtonProps extends ShareOptions {
  className?: string;
  variant?: 'compact' | 'pill' | 'icon';
}

export const ShareButton: React.FC<ShareButtonProps> = ({
  title,
  itemType,
  id,
  code,
  textDetails,
  className = '',
  variant = 'compact'
}) => {
  const [copied, setCopied] = useState(false);

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    await shareItem({ title, itemType, id, code, textDetails });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleShare}
        title="Share to WhatsApp / Apps"
        className={`p-1.5 rounded-lg bg-[#070D1A]/80 border border-[#1E2E52] text-[#9AA8C7] hover:text-[#FFC700] hover:border-[#FFC700]/50 transition-colors cursor-pointer shrink-0 ${className}`}
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
      </button>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        onClick={handleShare}
        title="Share to WhatsApp / Apps"
        className={`px-2.5 py-1 rounded-full bg-[#070D1A] border border-[#1E2E52] text-[11px] font-semibold text-[#9AA8C7] hover:text-[#E6ECFA] hover:border-[#2F52FF] transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${className}`}
      >
        {copied ? (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">Shared!</span>
          </>
        ) : (
          <>
            <Share2 className="w-3 h-3 text-[#FFC700]" />
            <span>Share</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      title="Share to WhatsApp / Apps"
      className={`px-2 py-1 rounded-lg bg-[#070D1A] border border-[#1E2E52] text-[11px] font-semibold text-[#9AA8C7] hover:text-[#E6ECFA] hover:border-[#2F52FF] transition-all flex items-center gap-1 cursor-pointer shrink-0 ${className}`}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400">Shared</span>
        </>
      ) : (
        <>
          <Share2 className="w-3 h-3 text-[#FFC700]" />
          <span>Share</span>
        </>
      )}
    </button>
  );
};
