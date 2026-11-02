import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { ActivityLog } from '../types';

export interface LogActivityParams {
  uid: string;
  email: string;
  role: string;
  action: 'Created' | 'Updated' | 'Deleted';
  itemType: 'Course' | 'Topic' | 'Resource' | 'Past Question' | 'Quiz' | 'Announcement' | 'Link' | 'Solution';
  title: string;
}

/**
 * Records admin or rep modifications into the 'activityLogs' collection.
 * Conforms to privacy standard: never logs student personal data.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    if (!params.uid) return;
    const logEntry: Omit<ActivityLog, 'id'> = {
      uid: params.uid,
      email: params.email || 'unknown',
      role: params.role || 'Admin',
      action: params.action,
      itemType: params.itemType,
      title: params.title.trim().slice(0, 150),
      createdAt: new Date().toISOString()
    };
    await addDoc(collection(db, 'activityLogs'), logEntry);
  } catch (err) {
    // Fail-open: Activity logging should never disrupt user actions
    console.warn('Failed to record activity log entry:', err);
  }
}
