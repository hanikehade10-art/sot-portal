import { db, cleanFirestoreData } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { WeeklyLeaderboardEntry } from '../types';

/**
 * Returns the current calendar week identifier in Africa/Lagos (Monday to Sunday).
 * Format: 'YYYY-Www' (e.g., '2026-W45')
 */
export function getCurrentWeekId(d: Date = new Date()): string {
  // Use date in Africa/Lagos
  const lagosDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);

  const [yearStr, monthStr, dayStr] = lagosDateStr.split('-');
  const date = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, parseInt(dayStr, 10)));

  // Thursday in current week decides the year (ISO-8601)
  const day = (date.getUTCDay() + 6) % 7; // Monday = 0, Sunday = 6
  date.setUTCDate(date.getUTCDate() - day + 3);
  const firstThursday = date.getTime();
  date.setUTCMonth(0, 1);
  if (date.getUTCDay() !== 4) {
    date.setUTCMonth(0, 1 + ((4 - date.getUTCDay() + 7) % 7));
  }
  const weekNumber = 1 + Math.ceil((firstThursday - date.getTime()) / 604800000);
  const weekPadded = weekNumber < 10 ? `0${weekNumber}` : `${weekNumber}`;
  return `${yearStr}-W${weekPadded}`;
}

/**
 * Returns a friendly date range label for the current week, e.g. "Nov 2 - Nov 8".
 */
export function getWeekDateRangeDisplay(d: Date = new Date()): string {
  try {
    const lagosDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);

    const [year, month, day] = lagosDateStr.split('-').map(Number);
    const curr = new Date(year, month - 1, day);
    const dayOfWeek = (curr.getDay() + 6) % 7; // 0 = Mon, 6 = Sun

    const monday = new Date(curr);
    monday.setDate(curr.getDate() - dayOfWeek);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const monFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(monday);
    const sunFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(sunday);

    return `${monFmt} – ${sunFmt}`;
  } catch {
    return 'This Week';
  }
}

/**
 * Extracts student's first name only to preserve privacy.
 * Never exposes full surname, matric number, or email.
 */
export function extractFirstNameOnly(fullName?: string): string {
  if (!fullName || typeof fullName !== 'string') return 'Student';
  const clean = fullName.trim().split(/\s+/)[0];
  return clean ? clean.charAt(0).toUpperCase() + clean.slice(1).toLowerCase() : 'Student';
}

/**
 * Records or updates weekly quiz points for an opted-in student.
 */
export async function recordWeeklyQuizPoints(params: {
  uid: string;
  department: string;
  fullName?: string;
  earnedPoints: number;
  optIn: boolean;
}): Promise<void> {
  const { uid, department, fullName, earnedPoints, optIn } = params;
  if (!uid || !department) return;

  try {
    const weekId = getCurrentWeekId();
    const docId = `${weekId}_${uid}`;
    const docRef = doc(db, 'weeklyLeaderboard', docId);

    const firstName = extractFirstNameOnly(fullName);
    const now = new Date().toISOString();

    const existingSnap = await getDoc(docRef).catch(() => null);
    let previousPoints = 0;
    let previousQuizzes = 0;

    if (existingSnap && existingSnap.exists()) {
      const data = existingSnap.data();
      previousPoints = Number(data.points || 0);
      previousQuizzes = Number(data.quizzesCompleted || 0);
    }

    const payload: WeeklyLeaderboardEntry = {
      id: docId,
      weekId,
      uid,
      department,
      firstName,
      points: previousPoints + Math.max(0, earnedPoints),
      quizzesCompleted: previousQuizzes + 1,
      optIn: Boolean(optIn),
      updatedAt: now
    };

    const sanitized = cleanFirestoreData(payload);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Leaderboard score update notice:', err);
  }
}

/**
 * Toggles a student's opt-in status on their current week's leaderboard record.
 */
export async function setLeaderboardOptInStatus(params: {
  uid: string;
  department: string;
  fullName?: string;
  optIn: boolean;
}): Promise<void> {
  const { uid, department, fullName, optIn } = params;
  if (!uid || !department) return;

  try {
    const weekId = getCurrentWeekId();
    const docId = `${weekId}_${uid}`;
    const docRef = doc(db, 'weeklyLeaderboard', docId);

    const firstName = extractFirstNameOnly(fullName);
    const now = new Date().toISOString();

    const existingSnap = await getDoc(docRef).catch(() => null);
    const previousPoints = existingSnap && existingSnap.exists() ? Number(existingSnap.data().points || 0) : 0;
    const previousQuizzes = existingSnap && existingSnap.exists() ? Number(existingSnap.data().quizzesCompleted || 0) : 0;

    const payload: WeeklyLeaderboardEntry = {
      id: docId,
      weekId,
      uid,
      department,
      firstName,
      points: previousPoints,
      quizzesCompleted: previousQuizzes,
      optIn: Boolean(optIn),
      updatedAt: now
    };

    const sanitized = cleanFirestoreData(payload);
    await setDoc(docRef, sanitized, { merge: true });
  } catch (err) {
    console.warn('Failed to update leaderboard opt-in status:', err);
  }
}
