/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import { StudentActivityItem, StudentActivityType } from '../types';

/**
 * Categorize client device into strictly 'Android', 'iPhone', or 'Desktop' only
 */
export function detectDeviceCategory(): 'Android' | 'iPhone' | 'Desktop' {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent || '';
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone';
  return 'Desktop';
}

// 10 minutes in milliseconds
const TEN_MINUTES_MS = 10 * 60 * 1000;

/**
 * Throttled update of lastActiveAt on the student's user document
 * Updates at most once every 10 minutes while the app is open
 */
export async function recordUserActivePing(uid: string): Promise<void> {
  if (!uid) return;

  const storageKey = `sot_active_ping_${uid}`;
  const lastPingStr = localStorage.getItem(storageKey);
  const now = Date.now();

  if (lastPingStr) {
    const lastPing = parseInt(lastPingStr, 10);
    if (!isNaN(lastPing) && now - lastPing < TEN_MINUTES_MS) {
      // Throttled: less than 10 minutes since last update
      return;
    }
  }

  // Update localStorage timestamp immediately to prevent duplicate calls
  localStorage.setItem(storageKey, String(now));

  try {
    if (auth.currentUser && auth.currentUser.uid === uid) {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'users', uid), {
        lastActiveAt: nowIso
      });
    }
  } catch (err) {
    // Non-blocking ping failure (e.g. offline)
    console.warn('Active ping error:', err);
  }
}

/**
 * Log student activity event
 * Strictly allowed types:
 * - 'login'
 * - 'logout'
 * - 'lesson opened'
 * - 'topic completed'
 * - 'quiz started'
 * - 'quiz submitted'
 * - 'past question opened'
 */
export async function logStudentActivity(params: {
  uid: string;
  name?: string;
  department?: string;
  level?: string;
  type: StudentActivityType;
  title: string;
}): Promise<void> {
  const { uid, name, department, level, type, title } = params;
  if (!uid || !type) return;

  const nowIso = new Date().toISOString();
  const payload: Omit<StudentActivityItem, 'id'> = {
    uid,
    name: name?.trim() || 'Student',
    department: department?.trim() || 'General',
    level: level?.trim() || 'ND1',
    type,
    title: title?.trim() || type,
    createdAt: nowIso
  };

  try {
    // Only attempt Firestore write if authenticated user matches uid (per firestore.rules)
    if (auth.currentUser && auth.currentUser.uid === uid) {
      await addDoc(collection(db, 'studentActivity'), payload);
    }
  } catch (err) {
    // Non-blocking logging failure
    console.warn('Failed to record student activity log:', err);
  }
}

/**
 * Format relative time (e.g. '2 hours ago', 'Just now')
 */
export function formatRelativeTime(isoDate?: string): string {
  if (!isoDate) return 'Never';
  const time = new Date(isoDate).getTime();
  if (isNaN(time)) return 'Never';

  const diffMs = Date.now() - time;
  if (diffMs < 0) return 'Just now';

  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return 'Just now';

  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }
  const months = Math.floor(diffDays / 30);
  return `${months} month${months === 1 ? '' : 's'} ago`;
}

/**
 * Format exact human readable date and time
 */
export function formatExactDate(isoDate?: string): string {
  if (!isoDate) return 'Not available';
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return 'Invalid date';

  return d.toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
