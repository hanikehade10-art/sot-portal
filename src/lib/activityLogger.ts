import { collection, addDoc as rawAddDoc } from 'firebase/firestore';
import { db, cleanFirestoreData } from './firebase';
import { ActivityLog } from '../types';

export interface LogActivityParams {
  uid: string;
  email: string;
  role: string;
  action: 'Created' | 'Updated' | 'Deleted';
  itemType: 'Course' | 'Topic' | 'Resource' | 'Past Question' | 'Quiz' | 'Announcement' | 'Link' | 'Solution' | 'Settings';
  title: string;
}

/**
 * Records admin or rep modifications into the 'activityLogs' collection.
 * Conforms to privacy standard: never logs student personal data.
 * Supports both object params and legacy positional arguments.
 */
export async function logActivity(
  paramsOrUser: LogActivityParams | any,
  role?: string,
  action?: 'Created' | 'Updated' | 'Deleted',
  itemType?: any,
  title?: string
): Promise<void> {
  try {
    let resolvedUid = '';
    let resolvedEmail = '';
    let resolvedRole = '';
    let resolvedAction: 'Created' | 'Updated' | 'Deleted' = 'Created';
    let resolvedItemType: any = 'Course';
    let resolvedTitle = '';

    if (paramsOrUser && typeof paramsOrUser === 'object' && 'action' in paramsOrUser && 'itemType' in paramsOrUser) {
      resolvedUid = paramsOrUser.uid;
      resolvedEmail = paramsOrUser.email || 'unknown';
      resolvedRole = paramsOrUser.role || 'Admin';
      resolvedAction = paramsOrUser.action;
      resolvedItemType = paramsOrUser.itemType;
      resolvedTitle = paramsOrUser.title || '';
    } else {
      resolvedUid = paramsOrUser?.uid || '';
      resolvedEmail = paramsOrUser?.email || 'unknown';
      resolvedRole = role || 'Admin';
      resolvedAction = action || 'Updated';
      resolvedItemType = itemType || 'Course';
      resolvedTitle = title || '';
    }

    if (!resolvedUid) return;

    const logEntry: Omit<ActivityLog, 'id'> = {
      uid: resolvedUid,
      email: resolvedEmail,
      role: resolvedRole,
      action: resolvedAction,
      itemType: resolvedItemType,
      title: resolvedTitle.trim().slice(0, 150),
      createdAt: new Date().toISOString()
    };
    await rawAddDoc(collection(db, 'activityLogs'), cleanFirestoreData(logEntry));
  } catch (err) {
    // Fail-open: Activity logging should never disrupt user actions
    console.warn('Failed to record activity log entry:', (err as any)?.message || err);
  }
}

