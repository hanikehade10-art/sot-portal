import { initializeApp, getApps, cert } from 'firebase-admin/app';
import type { App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Auth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { Messaging } from 'firebase-admin/messaging';

// The project ID and Firestore database ID configured for this applet
export const FIREBASE_PROJECT_ID = 'sot-portal';
export const FIRESTORE_DATABASE_ID = 'ai-studio-3c7079bd-2bf7-4083-bcb0-ec91f15986e7';

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;
let cachedMessaging: Messaging | null = null;

/**
 * Checks if the Firebase Service Account JSON is provided in environment variables.
 */
export function isFirebaseAdminConfigured(): boolean {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  return Boolean(raw && typeof raw === 'string' && raw.trim().length > 0);
}

/**
 * Initializes and returns the Firebase Admin SDK instances.
 * Reads the service account JSON from FIREBASE_SERVICE_ACCOUNT environment variable.
 */
export function getFirebaseAdmin(): {
  app: App;
  auth: Auth;
  db: Firestore;
  messaging: Messaging;
} {
  if (cachedApp && cachedAuth && cachedDb && cachedMessaging) {
    return {
      app: cachedApp,
      auth: cachedAuth,
      db: cachedDb,
      messaging: cachedMessaging
    };
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    cachedApp = existingApps[0];
  } else {
    const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!rawServiceAccount) {
      throw new Error(
        'FIREBASE_SERVICE_ACCOUNT is not configured on the server. Please add the Firebase Service Account JSON to environment variables.'
      );
    }

    let serviceAccount: any;
    try {
      serviceAccount = typeof rawServiceAccount === 'string' ? JSON.parse(rawServiceAccount) : rawServiceAccount;
    } catch (parseErr: any) {
      throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT JSON: ${parseErr.message}`);
    }

    cachedApp = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || FIREBASE_PROJECT_ID
    });
  }

  cachedAuth = getAuth(cachedApp);
  cachedDb = getFirestore(cachedApp, FIRESTORE_DATABASE_ID);
  try {
    cachedDb.settings({ ignoreUndefinedProperties: true });
  } catch {}
  cachedMessaging = getMessaging(cachedApp);

  return {
    app: cachedApp,
    auth: cachedAuth,
    db: cachedDb,
    messaging: cachedMessaging
  };
}

/**
 * Converts a department name or ID into a clean topic slug (e.g. "Computer Technology" -> "comp-tech").
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

export interface VerifiedCaller {
  uid: string;
  email?: string;
  role: 'admin' | 'rep' | 'student';
  department?: string;
  level?: string;
}

/**
 * Verifies the caller's Firebase ID token and reads their role from the SAME named Firestore database.
 */
export async function verifyCaller(req: any): Promise<VerifiedCaller> {
  const { auth, db } = getFirebaseAdmin();

  let idToken = '';
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    idToken = authHeader.slice(7).trim();
  } else if (req.body?.idToken) {
    idToken = String(req.body.idToken).trim();
  }

  if (!idToken) {
    throw new Error('Unauthorized: Missing Firebase ID token in Authorization header or request body.');
  }

  let decodedToken;
  try {
    decodedToken = await auth.verifyIdToken(idToken);
  } catch (err: any) {
    throw new Error(`Unauthorized: Invalid or expired Firebase ID token (${err.message || 'Verification failed'}).`);
  }

  // Read role and department from the SAME named Firestore database
  const userDocRef = db.collection('users').doc(decodedToken.uid);
  const userSnap = await userDocRef.get();
  const userData = userSnap.data() || {};

  const role: 'admin' | 'rep' | 'student' =
    userData.role === 'admin' || decodedToken.admin ? 'admin' : userData.role === 'rep' ? 'rep' : 'student';

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || userData.email,
    role,
    department: userData.department || '',
    level: userData.level || ''
  };
}
