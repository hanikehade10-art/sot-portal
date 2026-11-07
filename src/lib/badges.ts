import { db } from './firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { BadgeId, BadgeItem, UserProfile } from '../types';

export const BADGE_DEFINITIONS: BadgeItem[] = [
  {
    id: 'first-quiz',
    name: 'First Quiz',
    description: 'Finished your first syllabus quiz on SOT Portal.',
    criteria: 'Finish 1 quiz',
    iconName: 'Award'
  },
  {
    id: '7-day-streak',
    name: '7-Day Streak',
    description: 'Studied consistently on SOT Portal for 7 consecutive days.',
    criteria: 'Reach a 7-day study streak',
    iconName: 'Flame'
  },
  {
    id: 'perfect-score',
    name: 'Perfect Score',
    description: 'Scored 100% on any departmental quiz.',
    criteria: 'Score 100% on a quiz',
    iconName: 'Trophy'
  },
  {
    id: '10-quizzes',
    name: '10 Quizzes',
    description: 'Completed 10 quizzes to solidify polytechnic knowledge.',
    criteria: 'Finish 10 quizzes',
    iconName: 'CheckCircle2'
  }
];

export interface BadgeCheckContext {
  uid: string;
  currentBadges?: string[];
  streakCount?: number;
  longestStreak?: number;
  totalQuizzesTaken?: number;
  latestScorePercentage?: number;
}

/**
 * Evaluates whether the student qualifies for any new badges.
 * If new badges are found, saves them to Firestore and returns the unlocked badge items.
 */
export async function checkAndAwardBadges(context: BadgeCheckContext): Promise<BadgeItem[]> {
  const {
    uid,
    currentBadges = [],
    streakCount = 0,
    longestStreak = 0,
    totalQuizzesTaken = 0,
    latestScorePercentage
  } = context;

  if (!uid) return [];

  const existingSet = new Set(currentBadges);
  const newlyUnlocked: BadgeItem[] = [];

  // 1. First Quiz
  if (!existingSet.has('first-quiz') && totalQuizzesTaken >= 1) {
    const badge = BADGE_DEFINITIONS.find(b => b.id === 'first-quiz');
    if (badge) newlyUnlocked.push(badge);
  }

  // 2. 7-Day Streak
  const effectiveStreak = Math.max(streakCount, longestStreak);
  if (!existingSet.has('7-day-streak') && effectiveStreak >= 7) {
    const badge = BADGE_DEFINITIONS.find(b => b.id === '7-day-streak');
    if (badge) newlyUnlocked.push(badge);
  }

  // 3. Perfect Score (100% on any quiz)
  if (!existingSet.has('perfect-score') && latestScorePercentage !== undefined && latestScorePercentage >= 100) {
    const badge = BADGE_DEFINITIONS.find(b => b.id === 'perfect-score');
    if (badge) newlyUnlocked.push(badge);
  }

  // 4. 10 Quizzes
  if (!existingSet.has('10-quizzes') && totalQuizzesTaken >= 10) {
    const badge = BADGE_DEFINITIONS.find(b => b.id === '10-quizzes');
    if (badge) newlyUnlocked.push(badge);
  }

  if (newlyUnlocked.length > 0) {
    const newIds = newlyUnlocked.map(b => b.id);
    try {
      await updateDoc(doc(db, 'users', uid), {
        badges: arrayUnion(...newIds)
      });
    } catch (err) {
      console.warn('Could not update badges in Firestore:', err);
    }
  }

  return newlyUnlocked;
}
