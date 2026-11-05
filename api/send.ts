import { getFirebaseAdmin, verifyCaller, getDepartmentTopicSlug, isFirebaseAdminConfigured } from './lib/admin.ts';

// In-memory sliding window rate limiter: 20 sends per 1 hour per sender UID
const sendRateLimits = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SENDS_PER_HOUR = 20;

function checkAndCommitRateLimit(uid: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const history = (sendRateLimits.get(uid) || []).filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);

  if (history.length >= MAX_SENDS_PER_HOUR) {
    sendRateLimits.set(uid, history);
    return { allowed: false, remaining: 0 };
  }

  history.push(now);
  sendRateLimits.set(uid, history);
  return { allowed: true, remaining: MAX_SENDS_PER_HOUR - history.length };
}

/**
 * Vercel Serverless Function & Express Route Handler
 * Sends a push notification to an FCM topic.
 * - Verifies caller's Firebase ID token
 * - Reads role from the SAME named Firestore database
 * - Enforces permissions: Admins (any topic), Reps (only their department topics)
 * - Rate limits to 20 sends per hour per sender
 */
export default async function handler(req: any, res: any) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // Gracefully handle unconfigured service account (push notifications are optional)
  if (!isFirebaseAdminConfigured()) {
    return res.status(200).json({
      success: false,
      skipped: true,
      reason: 'FIREBASE_SERVICE_ACCOUNT is not configured on the server. Push notification broadcast was skipped.'
    });
  }

  try {
    // 1. Verify caller ID token and role from named Firestore database
    const caller = await verifyCaller(req);

    if (caller.role !== 'admin' && caller.role !== 'rep') {
      return res.status(403).json({
        error: 'Forbidden: Only administrators and designated course representatives can broadcast push notifications.'
      });
    }

    // 2. Validate input fields
    const { topic, title, body, link } = req.body || {};

    if (!topic || typeof topic !== 'string' || !topic.trim()) {
      return res.status(400).json({ error: 'Topic is required.' });
    }
    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'Notification title is required.' });
    }
    if (!body || typeof body !== 'string' || !body.trim()) {
      return res.status(400).json({ error: 'Notification body text is required.' });
    }

    const cleanTopic = topic.trim();
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    const cleanLink = (link && typeof link === 'string' && link.trim()) ? link.trim() : '/dashboard';

    // 3. Permission verification: Reps can only send to their own department topics
    if (caller.role === 'rep') {
      if (!caller.department) {
        return res.status(403).json({
          error: 'Forbidden: Your representative account is not assigned to an academic department.'
        });
      }

      const repDeptSlug = getDepartmentTopicSlug(caller.department);
      const isAllowedTopic =
        cleanTopic === `dept-${repDeptSlug}` ||
        cleanTopic.startsWith(`dept-${repDeptSlug}-`);

      if (!isAllowedTopic) {
        return res.status(403).json({
          error: `Forbidden: Course representatives can only send push notifications to their department topics (dept-${repDeptSlug}), not "${cleanTopic}".`
        });
      }
    }

    // 4. Rate Limiting: 20 sends per hour per sender
    const rateCheck = checkAndCommitRateLimit(caller.uid);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded: You have reached the limit of ${MAX_SENDS_PER_HOUR} notifications per hour. Please wait before broadcasting more.`
      });
    }

    // 5. Initialize Firebase Admin and Send FCM message
    const { messaging } = getFirebaseAdmin();

    const messagePayload: any = {
      topic: cleanTopic,
      notification: {
        title: cleanTitle.slice(0, 80),
        body: cleanBody.slice(0, 200)
      },
      data: {
        title: cleanTitle.slice(0, 80),
        body: cleanBody.slice(0, 200),
        link: cleanLink
      },
      webpush: {
        fcmOptions: {
          link: cleanLink
        },
        notification: {
          title: cleanTitle.slice(0, 80),
          body: cleanBody.slice(0, 200),
          icon: '/icon-192.png',
          badge: '/icon-192.png'
        }
      }
    };

    const messageId = await messaging.send(messagePayload);

    return res.status(200).json({
      success: true,
      messageId,
      topic: cleanTopic,
      remainingHourlySends: rateCheck.remaining
    });
  } catch (error: any) {
    console.error('api/send error:', error);
    const isAuth = error.message?.includes('Unauthorized');
    const isForbidden = error.message?.includes('Forbidden');
    const status = isAuth ? 401 : isForbidden ? 403 : 500;
    return res.status(status).json({
      error: error.message || 'Failed to send notification via Firebase Cloud Messaging.'
    });
  }
}
