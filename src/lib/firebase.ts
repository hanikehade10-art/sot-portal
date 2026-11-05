import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  doc,
  getDocFromServer,
  setDoc as rawSetDoc,
  updateDoc as rawUpdateDoc,
  addDoc as rawAddDoc
} from 'firebase/firestore';
import type {
  DocumentReference,
  CollectionReference,
  SetOptions,
  UpdateData,
  WithFieldValue
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

const firestoreDatabaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;

let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      ignoreUndefinedProperties: true
    },
    firestoreDatabaseId
  );
} catch (e) {
  console.warn('Persistent local cache initialization fallback:', e);
  try {
    firestoreInstance = initializeFirestore(
      app,
      {
        ignoreUndefinedProperties: true
      },
      firestoreDatabaseId
    );
  } catch {
    firestoreInstance = firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
  }
}

export const db = firestoreInstance;

// Common optional text fields that should be converted from undefined to empty string
const CONVERT_TO_EMPTY_STRING_KEYS = new Set([
  'explanation',
  'topicId',
  'courseId',
  'description',
  'instructions',
  'notes',
  'summary',
  'videoUrl',
  'content',
  'url',
  'link',
  'author',
  'adminReply',
  'studentName',
  'matricNumber',
  'jambNumber',
  'fullName',
  'category',
  'session',
  'year',
  'modelAnswer',
  'scope'
]);

/**
 * Recursively cleans any object or array before passing to Firestore:
 * - Converts undefined string-like fields (explanation, topicId, courseId, description, etc.) to ""
 * - Drops any remaining undefined properties so Firestore never encounters undefined
 * - Handles nested arrays, maps, and objects
 */
export function cleanFirestoreData<T = any>(input: any): T {
  if (input === null || input === undefined) {
    return input;
  }
  if (Array.isArray(input)) {
    return input
      .filter(item => item !== undefined)
      .map(item => cleanFirestoreData(item)) as unknown as T;
  }
  if (typeof input === 'object' && !(input instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(input)) {
      const val = input[key];
      if (val === undefined) {
        const lowerKey = key.toLowerCase();
        if (
          CONVERT_TO_EMPTY_STRING_KEYS.has(key) ||
          lowerKey.includes('explanation') ||
          lowerKey.includes('description') ||
          lowerKey.includes('topicid') ||
          lowerKey.includes('courseid') ||
          lowerKey.includes('whynot')
        ) {
          cleaned[key] = '';
        }
        // Otherwise omit the key entirely so undefined is never written
        continue;
      }
      cleaned[key] = cleanFirestoreData(val);
    }
    return cleaned as T;
  }
  return input;
}

/**
 * Safe wrapper for Firestore setDoc that automatically cleans and strips undefined values
 */
export async function safeSetDoc(
  reference: DocumentReference,
  data: any,
  options?: SetOptions
) {
  const sanitized = cleanFirestoreData(data);
  try {
    return options ? await rawSetDoc(reference, sanitized, options) : await rawSetDoc(reference, sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, reference.path);
  }
}

/**
 * Safe wrapper for Firestore updateDoc that automatically cleans and strips undefined values
 */
export async function safeUpdateDoc(
  reference: DocumentReference,
  data: any
) {
  const sanitized = cleanFirestoreData(data);
  try {
    return await rawUpdateDoc(reference, sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, reference.path);
  }
}

/**
 * Safe wrapper for Firestore addDoc that automatically cleans and strips undefined values
 */
export async function safeAddDoc(
  reference: CollectionReference,
  data: any
) {
  const sanitized = cleanFirestoreData(data);
  try {
    return await rawAddDoc(reference, sanitized);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, reference.path);
  }
}

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Error logging conforming to FirestoreErrorInfo
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection test on boot as mandated by the Firebase skill
export async function testConnection(): Promise<boolean> {
  try {
    // Attempting to probe connection
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Verify network connection and configuration.');
    }
    // Expected in rules if test doc is not readable, but connection itself is validated
    return false;
  }
}
