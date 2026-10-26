import React from 'react';
import { Flame, Sparkles, Trophy, Calendar } from 'lucide-react';

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
  // offset 0 = today, offset 6 = 6 days ago
  const today = new Date();
  const dots = Array.from({ length: 7 }, (_, i) => {
    const offset = 6 - i; // 6, 5, 4, 3, 2, 1, 0
    const d = new Date(today.getTime() - offset * 86400000);
    const dayLetter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Lagos',
      weekday: 'narrow'
    }).format(d);
    
    // A day is active if offset is within current streakCount
    const isActive = offset < Math.max(1, streakCount);
    const isToday = offset === 0;

    return { offset, dayLetter, isActive, isToday };
  });

  const getEncouragement = (count: number) => {
    if (count <= 1) return 'First spark lit! Return tomorrow to keep the flame alive.';
    if (count <= 3) return 'Great momentum! 2+ days of consistent learning.';
    if (count <= 6) return 'Fantastic dedication! You are building a powerful polytechnic study routine.';
    if (count <= 13) return "You're on fire! Superb consistency across your lectures and courses.";
    return 'Scholar Champion! Over two weeks of uninterrupted academic dedication.';
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-[#121C36] via-[#0F1E36] to-[#0A1224] border border-[#FFC700]/40 shadow-[0_4px_25px_rgba(255,199,0,0.12)] space-y-4">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#24315A]/70 pb-4">
        
        {/* Flame & Counts */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFC700] via-[#FF8800] to-[#E63946] p-0.5 shadow-[0_0_20px_rgba(255,199,0,0.4)]">
            <div className="w-full h-full bg-[#0A1224] rounded-[14px] flex items-center justify-center">
              <Flame className="w-6 h-6 text-[#FFC700] animate-pulse" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display font-extrabold text-xl text-[#E6ECFA]">
                {streakCount} {streakCount === 1 ? 'Day' : 'Days'} Streak
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40">
                ACTIVE
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#9AA8C7] mt-0.5">
              <Trophy className="w-3.5 h-3.5 text-[#FFC700]" />
              <span>Longest streak: <strong className="text-[#E6ECFA] font-mono">{longestStreak} days</strong></span>
              <span className="text-[#24315A]">•</span>
              <span className="text-[11px] text-[#9AA8C7]/70 font-mono">Africa/Lagos time</span>
            </div>
          </div>
        </div>

        {/* 7 Daily Activity Dots */}
        <div className="flex flex-col sm:items-end gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#9AA8C7]">
            Last 7 Days
          </span>
          <div className="flex items-center gap-2">
            {dots.map((dot, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <div
                  title={dot.isToday ? 'Today (Africa/Lagos)' : `${dot.dayLetter}`}
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold transition-all ${
                    dot.isActive
                      ? 'bg-gradient-to-br from-[#FFC700] to-[#E68A00] text-[#0A1224] shadow-[0_0_10px_rgba(255,199,0,0.35)]'
                      : 'bg-[#0A1224] border border-[#24315A] text-[#9AA8C7]'
                  } ${dot.isToday ? 'ring-2 ring-[#2F52FF] ring-offset-1 ring-offset-[#0A1224]' : ''}`}
                >
                  {dot.isActive ? '✓' : dot.dayLetter}
                </div>
                <span className={`text-[9px] font-mono ${dot.isToday ? 'text-[#FFC700] font-bold' : 'text-[#9AA8C7]/60'}`}>
                  {dot.isToday ? 'Now' : dot.dayLetter}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Encouraging message */}
      <div className="flex items-center gap-2.5 text-xs text-[#E6ECFA]">
        <Sparkles className="w-4 h-4 text-[#FFC700] shrink-0" />
        <span className="leading-relaxed">
          {getEncouragement(streakCount)}
        </span>
      </div>

    </div>
  );
};
