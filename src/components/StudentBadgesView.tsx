/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BADGE_DEFINITIONS } from '../lib/badges';
import { BadgeId, UserProfile } from '../types';
import {
  Award,
  Flame,
  Trophy,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Sparkles,
  Check
} from 'lucide-react';

interface StudentBadgesViewProps {
  profile: UserProfile | null;
  onBackToHome?: () => void;
  onOpenQuizzes?: () => void;
}

export const StudentBadgesView: React.FC<StudentBadgesViewProps> = ({
  profile,
  onBackToHome,
  onOpenQuizzes
}) => {
  const earnedBadgesSet = new Set<string>(profile?.badges || []);
  const earnedCount = BADGE_DEFINITIONS.filter(b => earnedBadgesSet.has(b.id)).length;
  const progressPct = Math.round((earnedCount / BADGE_DEFINITIONS.length) * 100);

  const renderBadgeIcon = (iconName: string, isUnlocked: boolean) => {
    const iconClass = isUnlocked ? 'w-7 h-7 text-[#FFC700]' : 'w-7 h-7 text-[#9AA8C7]/60';
    switch (iconName) {
      case 'Flame':
        return <Flame className={iconClass} />;
      case 'Trophy':
        return <Trophy className={iconClass} />;
      case 'CheckCircle2':
        return <CheckCircle2 className={isUnlocked ? 'w-7 h-7 text-emerald-400' : 'w-7 h-7 text-[#9AA8C7]/60'} />;
      default:
        return <Award className={iconClass} />;
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              className="p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-white transition-all cursor-pointer"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFC700]/20 text-[#FFC700] border border-[#FFC700]/40">
                Achievements
              </span>
              <span className="text-xs text-[#9AA8C7]">{profile?.department}</span>
            </div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#E6ECFA]">
              My Badges
            </h1>
          </div>
        </div>

        <div className="text-right">
          <span className="font-heading font-black text-lg text-[#FFC700]">
            {earnedCount} / {BADGE_DEFINITIONS.length}
          </span>
          <span className="text-[10px] text-[#9AA8C7] block">Unlocked</span>
        </div>
      </div>

      {/* Progress Card */}
      <div className="p-5 rounded-2xl bg-[#121C36] border border-[#24315A] space-y-3 shadow-md">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[#E6ECFA] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#FFC700]" />
            <span>Achievement Progress</span>
          </span>
          <span className="font-mono font-bold text-[#FFC700]">{progressPct}%</span>
        </div>

        <div className="w-full bg-[#0A1224] h-2.5 rounded-full overflow-hidden border border-[#24315A]">
          <div
            className="h-full bg-gradient-to-r from-[#2F52FF] to-[#FFC700] transition-all duration-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <p className="text-[11px] text-[#9AA8C7] leading-relaxed">
          {earnedCount === BADGE_DEFINITIONS.length
            ? 'Outstanding scholar! You have unlocked every single achievement badge!'
            : 'Complete syllabus quizzes, maintain daily study streaks, and aim for perfect scores to earn all badges.'}
        </p>
      </div>

      {/* Badges List Grid */}
      <div className="space-y-3">
        {BADGE_DEFINITIONS.map(badge => {
          const isUnlocked = earnedBadgesSet.has(badge.id);

          return (
            <div
              key={badge.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start gap-4 ${
                isUnlocked
                  ? 'bg-[#121C36] border-[#FFC700]/60 shadow-[0_0_15px_rgba(255,199,0,0.12)]'
                  : 'bg-[#0B1220] border-[#24315A]/60 opacity-60 grayscale'
              }`}
            >
              {/* Badge Icon circle */}
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border relative ${
                  isUnlocked
                    ? 'bg-gradient-to-br from-[#FFC700]/20 to-[#2F52FF]/20 border-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.25)]'
                    : 'bg-[#121C36] border-[#24315A]'
                }`}
              >
                {renderBadgeIcon(badge.iconName, isUnlocked)}
                {!isUnlocked && (
                  <div className="absolute -top-1 -right-1 p-1 rounded-full bg-[#0A1224] border border-[#24315A] text-[#9AA8C7]">
                    <Lock className="w-3 h-3" />
                  </div>
                )}
                {isUnlocked && (
                  <div className="absolute -bottom-1 -right-1 p-0.5 rounded-full bg-emerald-500 text-[#0A1224]">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              {/* Badge Details */}
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={`font-heading font-bold text-sm sm:text-base ${
                    isUnlocked ? 'text-[#E6ECFA]' : 'text-[#9AA8C7]'
                  }`}>
                    {badge.name}
                  </h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 border ${
                    isUnlocked
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'bg-[#0A1224] text-[#9AA8C7] border-[#24315A]'
                  }`}>
                    {isUnlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>

                <p className="text-xs text-[#9AA8C7] leading-relaxed">
                  {badge.description}
                </p>

                <div className="pt-1">
                  <span className="text-[10px] font-mono text-[#FFC700] bg-[#0A1224] px-2 py-0.5 rounded border border-[#24315A]/60 inline-block">
                    Criterion: {badge.criteria}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Action shortcuts */}
      {onOpenQuizzes && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenQuizzes}
            className="w-full py-3 px-4 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <span>Practice Quizzes to Earn Badges</span>
          </button>
        </div>
      )}
    </div>
  );
};
