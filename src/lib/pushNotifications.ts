import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { User } from 'firebase/auth';
import { app } from './firebase';

// Web push (VAPID) public key provided by user
export const VAPID_KEY = 'BOudpyAmVFiCG3ZPCEW_7yMElqAT89lYnCPaZCM3vXzwbgCvTxe6_C1QrVweT2KlALRNdpevqcFV9EZVozgr8sE';

export const LOCAL_STORAGE_KEY_TOKEN = 'sot_fcm_token';
export const LOCAL_STORAGE_KEY_ENABLED = 'sot_phone_notifications_enabled';

/**
 * Checks if Push Notifications and Service Workers are supported in the current browser.
 */
export async function isPushNotificationSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!hasApi) return false;
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/**
 * Converts a department name or ID into the standard topic slug.
 */
export function getDepartmentTopicSlug(deptName?: string): string {
  if (!deptName) return 'general';
  const clean = deptName.trim().toLowerCase();

  if (clean.includes('computer')) return 'comp-tech';
  if (clean.includes('food')) return 'food-tech';
  if (clean.includes('hospitality')) return 'hosp-mgmt';
  if (clean.includes('tourism') || clean.includes('leisure')) return 'tourism-mgmt';
  if (clean.includes('polymer') || clean.includes('textile')) return 'polymer-textile';
  if (clean.includes('nutrition') || clean.includes('dietetic')) return 'nutr-dietetics';

  return clean.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general';
}

/**
 * Subscribes the current device to phone push notifications via FCM.
 * Calls /api/subscribe to subscribe the token to topics:
 * - all
 * - dept-<department slug>
 * - dept-<department slug>-<level>
 */
export async function subscribeToPhoneNotifications(
  user: User,
  department?: string,
  level?: string
): Promise<{ success: boolean; token: string; topics: string[] }> {
  const supported = await isPushNotificationSupported();
  if (!supported) {
    throw new Error('Push notifications are not supported on this browser or platform.');
  }

  // 1. Request browser notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Notification permission was denied. Please allow notifications in your browser or site settings.'
        : 'Notification permission request was dismissed.'
    );
  }

  // 2. Register FCM Service Worker
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;

  // 3. Obtain FCM Web Push Token
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error('Unable to retrieve Firebase Cloud Messaging registration token.');
  }

  // 4. Send token and user ID token to server
  const idToken = await user.getIdToken(true);
  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({
      token,
      action: 'subscribe',
      department,
      level,
      idToken
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Server failed to subscribe device to notification topics.');
  }

  // 5. Store token and state locally
  localStorage.setItem(LOCAL_STORAGE_KEY_TOKEN, token);
  localStorage.setItem(LOCAL_STORAGE_KEY_ENABLED, 'true');

  return {
    success: true,
    token,
    topics: data.topics || ['all']
  };
}

/**
 * Unsubscribes the current device from phone push notifications.
 * Calls /api/subscribe with action: 'unsubscribe' and removes token from storage.
 */
export async function unsubscribeFromPhoneNotifications(
  user?: User | null,
  department?: string,
  level?: string
): Promise<void> {
  const token = localStorage.getItem(LOCAL_STORAGE_KEY_TOKEN);

  try {
    if (token && user) {
      const idToken = await user.getIdToken();
      await fetch('/api/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          token,
          action: 'unsubscribe',
          department,
          level,
          idToken
        })
      });
    }
  } catch (err) {
    console.warn('Unsubscribe error (ignored during cleanup):', err);
  } finally {
    localStorage.removeItem(LOCAL_STORAGE_KEY_TOKEN);
    localStorage.setItem(LOCAL_STORAGE_KEY_ENABLED, 'false');
  }
}

/**
 * Helper to dispatch a push notification via /api/send.
 * Verifies caller role on server and broadcasts to target topic.
 */
export async function dispatchPushNotification(
  params: {
    topic: string;
    title: string;
    body: string;
    link?: string;
  },
  user?: User | null
): Promise<{ success: boolean; skipped?: boolean; messageId?: string }> {
  if (!user) {
    console.warn('dispatchPushNotification skipped: User is not authenticated.');
    return { success: false, skipped: true };
  }

  try {
    const idToken = await user.getIdToken();

    const response = await fetch('/api/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`
      },
      body: JSON.stringify({
        ...params,
        idToken
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn('Push notification dispatch notice:', data.error || response.statusText);
      return { success: false, skipped: true };
    }

    if (data.skipped) {
      return { success: false, skipped: true };
    }

    return {
      success: true,
      messageId: data.messageId
    };
  } catch (err: any) {
    console.warn('Push notification dispatch notice (non-fatal):', err?.message || err);
    return { success: false, skipped: true };
  }
}
