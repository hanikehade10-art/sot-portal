import { getFirebaseAdmin, verifyCaller, getDepartmentTopicSlug, isFirebaseAdminConfigured } from './lib/admin.ts';

/**
 * Vercel Serverless Function & Express Route Handler
 * Subscribes or unsubscribes an FCM device token to/from student topics:
 * - all
 * - dept-<department slug>
 * - dept-<department slug>-<level>
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
      reason: 'FIREBASE_SERVICE_ACCOUNT is not configured on the server. Topic subscription was skipped.'
    });
  }

  try {
    // 1. Verify caller ID token and role
    const caller = await verifyCaller(req);

    const { token, action = 'subscribe', department, level } = req.body || {};

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'Missing or invalid FCM registration token.' });
    }

    const { messaging } = getFirebaseAdmin();

    // Determine topics based on student's verified department and level
    const targetDept = department || caller.department || 'Computer Technology';
    const deptSlug = getDepartmentTopicSlug(targetDept);
    const targetLevel = (level || caller.level || 'nd1').toString().toLowerCase().trim();

    const topicsToManage = [
      'all',
      `dept-${deptSlug}`,
      `dept-${deptSlug}-${targetLevel}`
    ];

    if (action === 'unsubscribe') {
      for (const topic of topicsToManage) {
        try {
          await messaging.unsubscribeFromTopic([token.trim()], topic);
        } catch (err: any) {
          console.warn(`Unsubscribe from ${topic} notice:`, err?.message || err);
        }
      }

      return res.status(200).json({
        success: true,
        action: 'unsubscribed',
        topics: topicsToManage
      });
    }

    // Default: Subscribe
    const subscribedTopics: string[] = [];
    for (const topic of topicsToManage) {
      const response = await messaging.subscribeToTopic([token.trim()], topic);
      if (response.failureCount === 0) {
        subscribedTopics.push(topic);
      } else {
        console.warn(`Failed to subscribe token to topic ${topic}:`, response.errors);
      }
    }

    return res.status(200).json({
      success: true,
      action: 'subscribed',
      topics: topicsToManage,
      subscribedTopics,
      student: {
        uid: caller.uid,
        department: targetDept,
        deptSlug,
        level: targetLevel
      }
    });
  } catch (error: any) {
    console.error('api/subscribe error:', error);
    const status = error.message?.includes('Unauthorized') ? 401 : 500;
    return res.status(status).json({
      error: error.message || 'Failed to update push notification subscription.'
    });
  }
}
