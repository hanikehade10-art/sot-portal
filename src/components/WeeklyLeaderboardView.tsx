/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { WeeklyLeaderboardEntry, UserProfile } from '../types';
import { getCurrentWeekId, getWeekDateRangeDisplay, setLeaderboardOptInStatus } from '../utils/leaderboard';
import {
  Trophy,
  Medal,
  Award,
  ArrowLeft,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  HelpCircle,
  ShieldCheck,
  RefreshCw,
  Users
} from 'lucide-react';

import { LeaderboardSkeleton } from './SkeletonLoader';
import { EmptyState } from './EmptyState';

interface WeeklyLeaderboardViewProps {
  studentDepartment: string;
  profile: UserProfile | null;
  uid: string;
  onBackToHome?: () => void;
  onOpenProfile?: () => void;
  onOpenQuizzes?: () => void;
  onRefreshProfile?: () => Promise<any> | void;
}

export const WeeklyLeaderboardView: React.FC<WeeklyLeaderboardViewProps> = ({
  studentDepartment,
  profile,
  uid,
  onBackToHome,
  onOpenProfile,
  onOpenQuizzes,
  onRefreshProfile
}) => {
  const [leaderboard, setLeaderboard] = useState<WeeklyLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingOptIn, setTogglingOptIn] = useState(false);

  const currentWeekId = getCurrentWeekId();
  const weekLabel = getWeekDateRangeDisplay();
  const isOptedIn = Boolean(profile?.showOnLeaderboard);

  // Fetch weekly top 10 for this student's department
  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const qRef = collection(db, 'weeklyLeaderboard');
      // Fetch records for this department and current week
      const qQuery = query(
        qRef,
        where('department', '==', studentDepartment),
        where('weekId', '==', currentWeekId),
        where('optIn', '==', true)
      );

      const snap = await getDocs(qQuery);
      const list: WeeklyLeaderboardEntry[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() } as WeeklyLeaderboardEntry);
      });

      // Sort client-side by points desc, limit 10
      list.sort((a, b) => (b.points || 0) - (a.points || 0));
      setLeaderboard(list.slice(0, 10));
    } catch (err) {
      console.warn('Leaderboard fetch note:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [studentDepartment, currentWeekId]);

  // Toggle opt-in directly from leaderboard screen
  const handleToggleOptIn = async () => {
    if (!uid || togglingOptIn) return;
    setTogglingOptIn(true);
    const nextStatus = !isOptedIn;

    try {
      // 1. Update user profile
      await updateDoc(doc(db, 'users', uid), {
        showOnLeaderboard: nextStatus
      });

      // 2. Sync to current week leaderboard record
      await setLeaderboardOptInStatus({
        uid,
        department: studentDepartment,
        fullName: profile?.fullName,
        optIn: nextStatus
      });

      if (onRefreshProfile) {
        await onRefreshProfile();
      }

      await fetchLeaderboard();
    } catch (err) {
      console.warn('Failed to update opt-in status:', err);
    } finally {
      setTogglingOptIn(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <div className="w-8 h-8 rounded-xl bg-[#FFC700] text-[#0A1224] font-black text-xs flex items-center justify-center shadow-[0_0_15px_rgba(255,199,0,0.4)]">
          1st
        </div>
      );
    }
    if (rank === 2) {
      return (
        <div className="w-8 h-8 rounded-xl bg-[#E2E8F0] text-[#0A1224] font-black text-xs flex items-center justify-center shadow-[0_0_12px_rgba(226,232,240,0.3)]">
          2nd
        </div>
      );
    }
    if (rank === 3) {
      return (
        <div className="w-8 h-8 rounded-xl bg-[#F97316] text-white font-black text-xs flex items-center justify-center shadow-[0_0_12px_rgba(249,115,22,0.3)]">
          3rd
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-xl bg-[#0A1224] border border-[#24315A] text-[#9AA8C7] font-mono font-bold text-xs flex items-center justify-center">
        {rank}
      </div>
    );
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
                Weekly Top 10
              </span>
              <span className="text-xs text-[#9AA8C7]">{studentDepartment}</span>
            </div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#E6ECFA]">
              Department Leaderboard
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchLeaderboard}
          className="p-2 rounded-xl bg-[#121C36] border border-[#24315A] text-[#9AA8C7] hover:text-white transition-all cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Week banner & Reset notice */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#121C36] via-[#16254a] to-[#121C36] border border-[#24315A] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FFC700]/15 border border-[#FFC700]/30 text-[#FFC700] flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-[#FFC700]" />
          </div>
          <div>
            <span className="text-xs font-bold text-[#E6ECFA] block">
              Current Cycle: {weekLabel}
            </span>
            <span className="text-[11px] text-[#9AA8C7]">
              Points reset automatically every Monday at 00:00 (WAT).
            </span>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-xl bg-[#0A1224] text-[#FFC700] border border-[#24315A] text-xs font-mono font-bold self-start sm:self-auto shrink-0">
          Top 10
        </span>
      </div>

      {/* Opt-In Privacy & Preference Card */}
      <div className="p-4 rounded-2xl bg-[#0B1220] border border-[#24315A] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-xs font-bold text-[#E6ECFA]">
                Leaderboard Participation (Opt-In)
              </span>
            </div>
            <p className="text-[11px] text-[#9AA8C7] leading-relaxed">
              Show your first name only on the department leaderboard. Your email, matric number, and contact details are never shown.
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleOptIn}
            disabled={togglingOptIn}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 border ${
              isOptedIn
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-[#121C36] text-[#9AA8C7] border-[#24315A] hover:text-[#E6ECFA]'
            }`}
          >
            {togglingOptIn ? 'Updating...' : isOptedIn ? 'Opted In ✓' : 'Opt In'}
          </button>
        </div>

        {!isOptedIn && (
          <p className="text-[10px] text-amber-400/90 italic border-t border-[#24315A]/60 pt-2">
            You are currently viewing the leaderboard in anonymous mode. You can view all top scores, but your own quiz points are not ranked publicly until you opt in.
          </p>
        )}
      </div>

      {/* Leaderboard Table / Cards */}
      <div className="space-y-2.5">
        {loading ? (
          <LeaderboardSkeleton count={5} />
        ) : leaderboard.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No Leaderboard Scores Yet This Week"
            description={`Be the first student in ${studentDepartment} to complete a quiz this week and take the #1 spot!`}
            actionLabel={onOpenQuizzes ? "Take a Quiz Now" : undefined}
            onAction={onOpenQuizzes}
          />
        ) : (
          leaderboard.map((entry, idx) => {
            const rank = idx + 1;
            const isCurrentUser = entry.uid === uid;

            return (
              <div
                key={entry.id || idx}
                className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isCurrentUser
                    ? 'bg-[#121C36] border-[#FFC700] shadow-[0_0_15px_rgba(255,199,0,0.15)] ring-1 ring-[#FFC700]'
                    : 'bg-[#121C36]/80 border-[#24315A] hover:border-[#384A75]'
                }`}
              >
                {/* Left: Rank & First Name */}
                <div className="flex items-center gap-3 min-w-0">
                  {getRankBadge(rank)}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-bold text-sm text-[#E6ECFA] truncate">
                        {entry.firstName}
                      </span>
                      {isCurrentUser && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider bg-[#FFC700] text-[#0A1224]">
                          You
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#9AA8C7]">
                      {entry.quizzesCompleted || 1} quiz{(entry.quizzesCompleted || 1) === 1 ? '' : 'zes'} completed
                    </span>
                  </div>
                </div>

                {/* Right: Points */}
                <div className="text-right shrink-0">
                  <div className="font-heading font-black text-base sm:text-lg text-[#FFC700]">
                    {entry.points}
                  </div>
                  <span className="text-[10px] text-[#9AA8C7] block uppercase font-mono">
                    Points
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Practice Shortcut */}
      {onOpenQuizzes && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenQuizzes}
            className="w-full py-3 px-4 rounded-xl bg-[#2F52FF] hover:bg-[#2545df] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
          >
            <span>Practice Department Quizzes to Climb the Board</span>
          </button>
        </div>
      )}
    </div>
  );
};
