import React, { useState } from 'react';
import { WhatsAppIcon } from './WhatsAppIcon';
import { Copy, Check } from 'lucide-react';

interface WhatsAppScoreShareProps {
  percentage: number;
  courseCode: string;
  examLabel?: string;
  className?: string;
}

export const WhatsAppScoreShare: React.FC<WhatsAppScoreShareProps> = ({
  percentage,
  courseCode,
  examLabel = 'Quiz',
  className = ''
}) => {
  const [copied, setCopied] = useState(false);

  const cleanCourse = courseCode.trim() || 'SOT Exam';
  const cleanPct = Math.round(percentage);
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://sot-portal.web.app';
  const shareMessage = `I scored ${cleanPct}% in ${cleanCourse} on SOT Portal! Can you beat me? ${siteUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareMessage);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareMessage;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.warn('Failed to copy score message:', err);
    }
  };

  return (
    <div className={`p-4 rounded-2xl bg-[#0B1220] border border-[#24315A] space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#FFC700] uppercase tracking-wider flex items-center gap-1.5">
          <WhatsAppIcon className="w-3.5 h-3.5 text-[#25D366]" />
          <span>Challenge your coursemates</span>
        </span>
        <span className="text-[10px] text-[#9AA8C7]">No private info shared</span>
      </div>

      <p className="text-xs text-[#9AA8C7] line-clamp-2 italic bg-[#121C36]/70 p-2 rounded-xl border border-[#24315A]/60 font-mono text-[11px] text-[#E6ECFA]">
        &ldquo;{shareMessage}&rdquo;
      </p>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 min-w-[170px] py-2.5 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
          <WhatsAppIcon className="w-4 h-4 text-white shrink-0" />
          <span>Share on WhatsApp</span>
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className={`py-2.5 px-3.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
            copied
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : 'bg-[#121C36] hover:bg-[#1A2649] border-[#24315A] text-[#E6ECFA]'
          }`}
          title="Copy message to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#9AA8C7]" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
