import React from 'react';
import { BadgeItem } from '../types';
import { Award, Flame, Trophy, CheckCircle2, Sparkles, X } from 'lucide-react';

interface BadgeUnlockedModalProps {
  badge: BadgeItem | null;
  onClose: () => void;
  onViewAllBadges?: () => void;
}

export const BadgeUnlockedModal: React.FC<BadgeUnlockedModalProps> = ({
  badge,
  onClose,
  onViewAllBadges
}) => {
  if (!badge) return null;

  const renderIcon = (name: string) => {
    switch (name) {
      case 'Flame':
        return <Flame className="w-8 h-8 text-[#FFC700] animate-pulse" />;
      case 'Trophy':
        return <Trophy className="w-8 h-8 text-[#FFC700]" />;
      case 'CheckCircle2':
        return <CheckCircle2 className="w-8 h-8 text-emerald-400" />;
      default:
        return <Award className="w-8 h-8 text-[#FFC700]" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm p-6 rounded-3xl bg-[#121C36] border-2 border-[#FFC700] space-y-4 shadow-2xl text-center relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#FFC700]/20 rounded-full blur-3xl pointer-events-none" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9AA8C7] hover:text-white p-1 rounded-lg"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Badge Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FFC700]/25 to-[#2F52FF]/20 border-2 border-[#FFC700] flex items-center justify-center mx-auto shadow-[0_0_25px_rgba(255,199,0,0.35)] relative">
          {renderIcon(badge.iconName)}
          <span className="absolute -bottom-2 -right-2 p-1 rounded-full bg-[#0A1224] border border-[#FFC700] text-[#FFC700]">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
        </div>

        <div className="space-y-1 relative z-10">
          <span className="px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40">
            Badge Unlocked!
          </span>
          <h3 className="font-heading font-extrabold text-xl text-[#E6ECFA] pt-1">
            {badge.name}
          </h3>
          <p className="text-xs text-[#9AA8C7] leading-relaxed max-w-xs mx-auto">
            {badge.description}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-2 relative z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            Awesome!
          </button>

          {onViewAllBadges && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onViewAllBadges();
              }}
              className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-[#0A1224] text-[#9AA8C7] hover:text-[#FFC700] text-xs font-semibold transition-all cursor-pointer"
            >
              View My Badges &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
