import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = ''
}) => {
  return (
    <div
      className={`p-8 sm:p-10 rounded-2xl bg-[#121C36] border border-[#24315A] text-center space-y-4 shadow-md ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#0A1224] border border-[#24315A] text-[#FFC700] flex items-center justify-center mx-auto shadow-inner">
        <Icon className="w-7 h-7 text-[#FFC700]" />
      </div>

      <div className="space-y-1.5 max-w-md mx-auto">
        <h3 className="font-heading font-extrabold text-base sm:text-lg text-[#E6ECFA]">
          {title}
        </h3>
        <p className="text-xs sm:text-sm text-[#9AA8C7] leading-relaxed">
          {description}
        </p>
      </div>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              className="py-2.5 px-4 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white font-bold text-xs shadow-md transition-all active:scale-[0.98] cursor-pointer"
            >
              {actionLabel}
            </button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="py-2.5 px-4 rounded-xl bg-[#0A1224] hover:bg-[#1A2649] border border-[#24315A] text-[#9AA8C7] hover:text-[#E6ECFA] font-semibold text-xs transition-all cursor-pointer"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
