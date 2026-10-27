import React from 'react';
import { Flame, Trophy } from 'lucide-react';

interface DailyStreakCardProps {
  streakCount: number;
  longestStreak: number;
  lastActiveDate?: string;
}

export const DailyStreakCard: React.FC<DailyStreakCardProps> = ({
  streakCount = 1,
  longestStreak = 1,
  lastActiveDate
}) => {
  // Generate the last 7 days in Africa/Lagos timezone
  const today = new Date();
  const dots = Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i; // 6, 5, 4, 3, 2, 1, 0
    const d = new Date(today.getTime() - offset * 86400000);
    const dayLetter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      weekday: 'narrow'
    }).format(d);

    const isActive = offset < Math.max(1, streakCount);
    const isToday = offset === 0;

    return { offset, dayLetter, isActive, isToday };
  });

  const getEncouragement = (count: number) => {
    if (count <= 1) return 'Return tomorrow to keep the flame alive!';
    if (count <= 3) return 'Great momentum! 2+ days of consistent study.';
    if (count <= 6) return 'Fantastic polytechnic study routine.';
    if (count <= 13) return "You're on fire! Superb lecture consistency.";
    return 'Scholar Champion! Over two weeks streak.';
  };

  return (
    <div className="p-2.5 sm:p-3 rounded-xl bg-[#121C36] border border-[#24315A] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      {/* Left: Flame, Count, Best, Encouraging message */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#FFC700]/15 border border-[#FFC700]/30 flex items-center justify-center text-[#FFC700] shrink-0">
          <Flame className="w-5 h-5 text-[#FFC700] animate-pulse" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-heading font-bold text-sm text-[#E6ECFA]">
              {streakCount} {streakCount === 1 ? 'day' : 'days'} streak
            </span>
            <span className="text-[11px] text-[#9AA8C7]">
              • Best: <strong className="text-[#FFC700]">{longestStreak}d</strong>
            </span>
          </div>
          <p className="text-[11px] text-[#9AA8C7] leading-none mt-0.5">
            {getEncouragement(streakCount)}
          </p>
        </div>
      </div>

      {/* Right: 7 small dots */}
      <div className="flex items-center gap-1.5 self-start sm:self-auto shrink-0">
        <span className="text-[10px] text-[#9AA8C7] mr-1 hidden sm:inline">
          Last 7 days:
        </span>
        {dots.map((dot, idx) => (
          <div
            key={idx}
            title={dot.isToday ? 'Today' : `${dot.dayLetter}`}
            className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
              dot.isActive
                ? 'bg-[#FFC700] text-[#0A1224]'
                : 'bg-[#0A1224] border border-[#24315A] text-[#9AA8C7]'
            } ${dot.isToday ? 'ring-1.5 ring-[#2F52FF]' : ''}`}
          >
            {dot.isActive ? '✓' : dot.dayLetter}
          </div>
        ))}
      </div>
    </div>
  );
};
