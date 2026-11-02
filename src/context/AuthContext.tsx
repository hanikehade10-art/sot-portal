import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updatePassword,
  reload
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testConnection } from '../lib/firebase';
import { UserProfile, SotDepartmentName, UserRole } from '../types';
import { SITE_CONFIG } from '../config/site';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  authReady: boolean;
  isAdmin: boolean;
  isRep: boolean;
  roleReadError: string | null;
  clearRoleReadError: () => void;
  loginLockoutMinutesRemaining: number | null;
  registerStep1: (email: string, password: string, fullName?: string) => Promise<User>;
  completeStep2: (department: SotDepartmentName, identifier: string, idType?: 'matric' | 'jamb') => Promise<void>;
  upgradeJambToMatric: (matricNumber: string) => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  updateStudentProfile: (fullName: string, newPassword?: string) => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function sanitizeMatricId(matric: string): string {
  return matric.trim().toUpperCase().replace(/[\/\s]/g, '_');
}

export function sanitizeJambId(jamb: string): string {
  return `JAMB_${jamb.trim().toUpperCase().replace(/\s+/g, '')}`;
}

export function checkIsAdminRole(roleValue: unknown): boolean {
  if (typeof roleValue !== 'string') return false;
  const cleaned = roleValue.replace(/\s+/g, '').toLowerCase();
  return cleaned === 'admin';
}

export function checkIsRepRole(roleValue: unknown): boolean {
  if (typeof roleValue !== 'string') return false;
  const cleaned = roleValue.replace(/\s+/g, '').toLowerCase();
  return cleaned === 'rep';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);
  const [roleReadError, setRoleReadError] = useState<string | null>(null);

  const clearRoleReadError = () => setRoleReadError(null);

  const lastActivityRef = useRef<number>(Date.now());

  // Test connection on boot
  useEffect(() => {
    testConnection();
  }, []);

  // Check login lockout status
  const checkLockout = useCallback((): number | null => {
    const lockoutUntil = localStorage.getItem('sot_lockout_until');
    if (lockoutUntil) {
      const remainingMs = parseInt(lockoutUntil, 10) - Date.now();
      if (remainingMs > 0) {
        return Math.ceil(remainingMs / (60 * 1000));
      } else {
        localStorage.removeItem('sot_lockout_until');
        localStorage.removeItem('sot_failed_attempts');
      }
    }
    return null;
  }, []);

  useEffect(() => {
    setLockoutRemaining(checkLockout());
    const interval = setInterval(() => {
      setLockoutRemaining(checkLockout());
    }, 10000);
    return () => clearInterval(interval);
  }, [checkLockout]);

  // Inactivity auto logout after 30 minutes
  const handleUserActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const inactivityInterval = setInterval(() => {
      if (user) {
        const inactiveMs = Date.now() - lastActivityRef.current;
        const maxInactiveMs = SITE_CONFIG.security.inactivityTimeoutMinutes * 60 * 1000;
        if (inactiveMs >= maxInactiveMs) {
          console.warn('Logging out due to 30 minutes of inactivity');
          sessionStorage.setItem('sot_inactivity_logout', 'true');
          logout();
        }
      }
    }, 30000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      clearInterval(inactivityInterval);
    };
  }, [user]);

  // Fetch or build user profile
  const fetchUserProfile = async (firebaseUser: User): Promise<UserProfile | null> => {
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    try {
      const snap = await getDoc(userDocRef);
      
      const isConfigAdmin = typeof firebaseUser.email === 'string' &&
        firebaseUser.email.trim().toLowerCase() === SITE_CONFIG.bootstrapAdminEmail.toLowerCase();

      let hasAdminDoc = false;
      try {
        const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
        hasAdminDoc = adminSnap.exists();
      } catch (e) {
        // rules may restrict
      }

      if (snap.exists()) {
        const data = snap.data();
        // Check role case-insensitively, ignoring spaces
        const isDocAdmin = checkIsAdminRole((data as any)?.role) || (data as any)?.isAdmin === true || (data as any)?.is_admin === true;
        const isDocRep = checkIsRepRole((data as any)?.role);

        const finalRole: UserRole = (isDocAdmin || isConfigAdmin || hasAdminDoc)
          ? 'admin'
          : (isDocRep ? 'rep' : 'student');
        const resolvedProfile: UserProfile = {
          ...(data as any),
          uid: firebaseUser.uid,
          email: (data as any)?.email || firebaseUser.email || '',
          role: finalRole
        };
        setRoleReadError(null);
        setProfile(resolvedProfile);
        localStorage.setItem('sot_local_profile', JSON.stringify(resolvedProfile));
        return resolvedProfile;
      } else {
        const isRoleAdmin = isConfigAdmin || hasAdminDoc;
        const initialRole: UserRole = isRoleAdmin ? 'admin' : 'student';
        const initialProfile: UserProfile = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || '',
          fullName: firebaseUser.displayName || '',
          profileComplete: isRoleAdmin ? true : false,
          role: initialRole,
          createdAt: new Date().toISOString()
        };

        if (isRoleAdmin) {
          try {
            await setDoc(userDocRef, initialProfile);
            setRoleReadError(null);
          } catch (e: any) {
            console.warn('Initial admin profile write:', e);
          }
        } else {
          const reason = `No user document found at users/${firebaseUser.uid} in Firestore. Role could not be read.`;
          console.warn(reason);
          setRoleReadError(reason);
        }

        setProfile(initialProfile);
        localStorage.setItem('sot_local_profile', JSON.stringify(initialProfile));
        return initialProfile;
      }
    } catch (err: any) {
      console.error('Profile fetch notice from Firestore:', err);
      const reason = err?.message || String(err) || 'Failed to read document from Firestore';
      setRoleReadError(`Unable to read user role from Firestore (users/${firebaseUser.uid}): ${reason}`);

      const isConfigAdmin = typeof firebaseUser.email === 'string' &&
        firebaseUser.email.trim().toLowerCase() === SITE_CONFIG.bootstrapAdminEmail.toLowerCase();
      const fallback: UserProfile = {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        profileComplete: isConfigAdmin ? true : false,
        role: isConfigAdmin ? 'admin' : 'student'
      };
      setProfile(fallback);
      return fallback;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        await fetchUserProfile(currentUser);
      } else {
        const localUserRaw = localStorage.getItem('sot_local_user');
        const localProfileRaw = localStorage.getItem('sot_local_profile');
        if (localUserRaw && localProfileRaw) {
          try {
            const pUser = JSON.parse(localUserRaw);
            const pProfile = JSON.parse(localProfileRaw);
            setUser(pUser);
            setProfile(pProfile);
          } catch (e) {
            setUser(null);
            setProfile(null);
          }
        } else {
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (auth.currentUser) {
      await reload(auth.currentUser);
      return await fetchUserProfile(auth.currentUser);
    }
    const localProfileRaw = localStorage.getItem('sot_local_profile');
    if (localProfileRaw) {
      const p = JSON.parse(localProfileRaw);
      setProfile(p);
      return p;
    }
    return null;
  };

  // Step 1: Register account (No email verification required)
  const registerStep1 = async (email: string, password: string, fullName: string = ''): Promise<User> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);

      const nowIso = new Date().toISOString();
      const isConfigAdmin = cred.user.email?.toLowerCase() === SITE_CONFIG.bootstrapAdminEmail.toLowerCase();
      const initialProfile: UserProfile = {
        uid: cred.user.uid,
        email: cred.user.email || email.trim(),
        fullName: fullName.trim(),
        profileComplete: false,
        role: isConfigAdmin ? 'admin' : 'student',
        privacyAcceptedAt: nowIso,
        createdAt: nowIso
      };

      try {
        await setDoc(doc(db, 'users', cred.user.uid), initialProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${cred.user.uid}`);
      }

      setUser(cred.user);
      setProfile(initialProfile);
      return cred.user;
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        const localUserRaw = localStorage.getItem('sot_local_user');
        if (localUserRaw) {
          try {
            const pUser = JSON.parse(localUserRaw);
            if (pUser.email?.toLowerCase() === email.trim().toLowerCase()) {
              const conflictErr: any = new Error('An account with this email address already exists. Please log in instead.');
              conflictErr.code = 'auth/email-already-in-use';
              throw conflictErr;
            }
          } catch (e: any) {
            if (e.code === 'auth/email-already-in-use') throw e;
          }
        }

        const mockUid = 'sot_' + Math.random().toString(36).substring(2, 9);
        const mockUser = {
          uid: mockUid,
          email: email.trim(),
          displayName: fullName.trim(),
          emailVerified: true
        } as unknown as User;

        const isConfigAdmin = email.trim().toLowerCase() === SITE_CONFIG.bootstrapAdminEmail.toLowerCase();
        const fallbackNow = new Date().toISOString();
        const initialProfile: UserProfile = {
          uid: mockUid,
          email: email.trim(),
          fullName: fullName.trim(),
          profileComplete: false,
          role: isConfigAdmin ? 'admin' : 'student',
          privacyAcceptedAt: fallbackNow,
          createdAt: fallbackNow
        };

        localStorage.setItem('sot_local_user', JSON.stringify(mockUser));
        localStorage.setItem('sot_local_profile', JSON.stringify(initialProfile));
        setUser(mockUser);
        setProfile(initialProfile);
        return mockUser;
      }
      throw err;
    }
  };

  // Step 2: Complete student details (Department & Unique Matric or JAMB Registration Number)
  const completeStep2 = async (
    department: SotDepartmentName,
    identifier: string,
    idType: 'matric' | 'jamb' = 'matric'
  ): Promise<void> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      throw new Error('No active user session found. Please sign in to complete registration.');
    }

    const cleanIdentifier = identifier.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanIdentifier) {
      throw new Error(idType === 'matric' ? 'Matriculation number is required.' : 'JAMB registration number is required.');
    }

    if (idType === 'matric') {
      const matricRegex = /^[A-Z0-9_\-\/]{4,30}$/;
      if (!matricRegex.test(cleanIdentifier)) {
        throw new Error('Matric number must contain 4-30 alphanumeric characters (e.g. F/ND/25/3210001).');
      }
    } else {
      const jambRegex = /^[A-Z0-9]{8,15}$/;
      if (!jambRegex.test(cleanIdentifier)) {
        throw new Error('JAMB registration number must contain 8 to 15 alphanumeric characters with no spaces (e.g. 2025123456AB).');
      }
    }

    const regDocId = idType === 'matric' ? sanitizeMatricId(cleanIdentifier) : `JAMB_${cleanIdentifier}`;
    const localMatrics = JSON.parse(localStorage.getItem('sot_matric_registry') || '{}');

    // Uniqueness verification
    if (auth.currentUser) {
      let activeReservedOwnerUid: string | null = null;

      const verifyOwnerActiveInFirebase = async (ownerUid: string): Promise<boolean> => {
        try {
          const userSnap = await getDoc(doc(db, 'users', ownerUid));
          return userSnap.exists();
        } catch {
          return false;
        }
      };

      // 1. Check direct doc in matricNumbers
      try {
        const snap = await getDoc(doc(db, 'matricNumbers', regDocId));
        if (snap.exists()) {
          const data = snap.data();
          const docOwner = data?.uid || data?.userId || data?.studentId || data?.user_id || null;
          if (docOwner) {
            const normalizedOwner = String(docOwner).trim();
            const normalizedCurrent = String(currentUser.uid).trim();
            if (normalizedOwner === normalizedCurrent) {
              // Reserved by the current user - allow them to proceed!
            } else {
              const stillExists = await verifyOwnerActiveInFirebase(normalizedOwner);
              if (!stillExists) {
                await deleteDoc(doc(db, 'matricNumbers', regDocId)).catch(() => {});
                await deleteDoc(doc(db, 'matric_registry', regDocId)).catch(() => {});
              } else {
                activeReservedOwnerUid = normalizedOwner;
              }
            }
          }
        }
      } catch (err) {
        // continue
      }

      // 2. Check query in matricNumbers
      if (!activeReservedOwnerUid) {
        try {
          const fieldToCheck = idType === 'matric' ? 'matricNumber' : 'jambNumber';
          const qSnap = await getDocs(query(collection(db, 'matricNumbers'), where(fieldToCheck, '==', cleanIdentifier)));
          if (!qSnap.empty) {
            for (const docSnap of qSnap.docs) {
              const data = docSnap.data();
              const docOwner = data?.uid || data?.userId || data?.studentId || data?.user_id || null;
              if (docOwner) {
                const normalizedOwner = String(docOwner).trim();
                const normalizedCurrent = String(currentUser.uid).trim();
                if (normalizedOwner !== normalizedCurrent) {
                  const stillExists = await verifyOwnerActiveInFirebase(normalizedOwner);
                  if (!stillExists) {
                    await deleteDoc(docSnap.ref).catch(() => {});
                  } else {
                    activeReservedOwnerUid = normalizedOwner;
                    break;
                  }
                }
              }
            }
          }
        } catch (err) {
          // continue
        }
      }

      // 3. Check legacy matric_registry
      if (!activeReservedOwnerUid) {
        try {
          const snapReg = await getDoc(doc(db, 'matric_registry', regDocId));
          if (snapReg.exists()) {
            const data = snapReg.data();
            const docOwner = data?.uid || data?.userId || null;
            if (docOwner) {
              const normalizedOwner = String(docOwner).trim();
              const normalizedCurrent = String(currentUser.uid).trim();
              if (normalizedOwner !== normalizedCurrent) {
                const stillExists = await verifyOwnerActiveInFirebase(normalizedOwner);
                if (!stillExists) {
                  await deleteDoc(doc(db, 'matric_registry', regDocId)).catch(() => {});
                } else {
                  activeReservedOwnerUid = normalizedOwner;
                }
              }
            }
          }
        } catch (err) {
          // continue
        }
      }

      // 4. Check active students in users collection
      if (!activeReservedOwnerUid) {
        try {
          const userField = idType === 'matric' ? 'matricNumber' : 'jambNumber';
          const usersQ = query(collection(db, 'users'), where(userField, '==', cleanIdentifier));
          const usersSnap = await getDocs(usersQ);
          if (!usersSnap.empty) {
            for (const uDoc of usersSnap.docs) {
              if (uDoc.id !== currentUser.uid) {
                activeReservedOwnerUid = uDoc.id;
                break;
              }
            }
          }
        } catch (err) {
          // continue
        }
      }

      if (activeReservedOwnerUid && activeReservedOwnerUid !== currentUser.uid) {
        if (idType === 'matric') {
          throw new Error(`Matriculation number "${cleanIdentifier}" has already been claimed by another student account.`);
        } else {
          throw new Error(`JAMB registration number "${cleanIdentifier}" has already been claimed by another student account.`);
        }
      }

      if (localMatrics[regDocId] && localMatrics[regDocId] !== currentUser.uid) {
        delete localMatrics[regDocId];
        localStorage.setItem('sot_matric_registry', JSON.stringify(localMatrics));
      }
      try {
        const localStudentsRaw = localStorage.getItem('sot_local_students');
        if (localStudentsRaw) {
          const localStudents = JSON.parse(localStudentsRaw);
          const filtered = localStudents.filter((s: any) =>
            (idType === 'matric' ? s.matricNumber !== cleanIdentifier : s.jambNumber !== cleanIdentifier) ||
            s.uid === currentUser.uid
          );
          localStorage.setItem('sot_local_students', JSON.stringify(filtered));
        }
      } catch {
        // ignore
      }
    } else {
      // Local fallback mode
      const localOwner = localMatrics[regDocId];
      if (localOwner && String(localOwner).trim() !== String(currentUser.uid).trim()) {
        throw new Error(
          idType === 'matric'
            ? `Matriculation number "${cleanIdentifier}" has already been claimed by another student account.`
            : `JAMB registration number "${cleanIdentifier}" has already been claimed by another student account.`
        );
      }
    }

    if (auth.currentUser) {
      const now = new Date().toISOString();
      const registryPayload: Record<string, any> = {
        idType,
        uid: currentUser.uid,
        userId: currentUser.uid,
        department,
        updatedAt: now
      };

      if (idType === 'matric') {
        registryPayload.matricNumber = cleanIdentifier;
      } else {
        registryPayload.jambNumber = cleanIdentifier;
        registryPayload.matricNumber = regDocId;
      }

      // Save/reserve in matricNumbers collection
      try {
        await setDoc(doc(db, 'matricNumbers', regDocId), {
          ...registryPayload,
          createdAt: now
        }, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `matricNumbers/${regDocId}`);
      }

      // Also sync to legacy matric_registry
      try {
        await setDoc(doc(db, 'matric_registry', regDocId), {
          ...registryPayload,
          createdAt: now
        }, { merge: true });
      } catch (err) {
        // optional sync
      }

      // Update student document in users collection
      const userDocRef = doc(db, 'users', currentUser.uid);
      const userUpdatePayload: Record<string, any> = {
        department,
        idType,
        profileComplete: true,
        updatedAt: now
      };
      if (idType === 'matric') {
        userUpdatePayload.matricNumber = cleanIdentifier;
      } else {
        userUpdatePayload.jambNumber = cleanIdentifier;
      }

      try {
        await updateDoc(userDocRef, userUpdatePayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      }
    }

    localMatrics[regDocId] = currentUser.uid;
    localStorage.setItem('sot_matric_registry', JSON.stringify(localMatrics));

    const updatedProfile: UserProfile = {
      uid: currentUser.uid,
      email: currentUser.email || '',
      fullName: profile?.fullName || '',
      department,
      idType,
      matricNumber: idType === 'matric' ? cleanIdentifier : undefined,
      jambNumber: idType === 'jamb' ? cleanIdentifier : undefined,
      profileComplete: true,
      role: profile?.role || 'student',
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem('sot_local_profile', JSON.stringify(updatedProfile));
    setProfile(updatedProfile);
  };

  // Upgrade student with JAMB number to permanent Matric number
  const upgradeJambToMatric = async (matricNumber: string): Promise<void> => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      throw new Error('No active user session found. Please sign in.');
    }

    const cleanMatric = matricNumber.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanMatric) {
      throw new Error('Matriculation number is required.');
    }

    const matricRegex = /^[A-Z0-9_\-\/]{4,30}$/;
    if (!matricRegex.test(cleanMatric)) {
      throw new Error('Matric number must contain 4-30 alphanumeric characters (e.g. F/ND/25/3210001).');
    }

    const matricDocId = sanitizeMatricId(cleanMatric);
    const now = new Date().toISOString();

    // Check uniqueness of matric number
    if (auth.currentUser) {
      const verifyOwnerActive = async (ownerUid: string): Promise<boolean> => {
        try {
          const userSnap = await getDoc(doc(db, 'users', ownerUid));
          return userSnap.exists();
        } catch {
          return false;
        }
      };

      const mSnap = await getDoc(doc(db, 'matricNumbers', matricDocId));
      if (mSnap.exists()) {
        const data = mSnap.data();
        const docOwner = data?.uid || data?.userId;
        if (docOwner && docOwner !== currentUser.uid) {
          const active = await verifyOwnerActive(docOwner);
          if (active) {
            throw new Error(`Matriculation number "${cleanMatric}" has already been claimed by another student account.`);
          }
        }
      }

      const usersQ = query(collection(db, 'users'), where('matricNumber', '==', cleanMatric));
      const uSnap = await getDocs(usersQ);
      if (!uSnap.empty) {
        for (const uDoc of uSnap.docs) {
          if (uDoc.id !== currentUser.uid) {
            throw new Error(`Matriculation number "${cleanMatric}" has already been claimed by another student account.`);
          }
        }
      }

      // 1. Reserve matric number
      const matricPayload = {
        matricNumber: cleanMatric,
        idType: 'matric',
        uid: currentUser.uid,
        userId: currentUser.uid,
        department: profile?.department || '',
        createdAt: now,
        updatedAt: now
      };

      await setDoc(doc(db, 'matricNumbers', matricDocId), matricPayload, { merge: true });
      await setDoc(doc(db, 'matric_registry', matricDocId), matricPayload, { merge: true }).catch(() => {});

      // 2. Update user doc: set idType to 'matric', save matricNumber, delete jambNumber
      await updateDoc(doc(db, 'users', currentUser.uid), {
        idType: 'matric',
        matricNumber: cleanMatric,
        jambNumber: deleteField(),
        updatedAt: now
      });

      // 3. Delete old JAMB reservation
      const oldJamb = profile?.jambNumber;
      if (oldJamb) {
        const jambClean = oldJamb.trim().toUpperCase().replace(/\s+/g, '');
        const jambDocId = `JAMB_${jambClean}`;
        await deleteDoc(doc(db, 'matricNumbers', jambDocId)).catch((err) => {
          console.warn('Could not delete old JAMB reservation doc:', err);
        });
        await deleteDoc(doc(db, 'matric_registry', jambDocId)).catch(() => {});

        const localMatrics = JSON.parse(localStorage.getItem('sot_matric_registry') || '{}');
        delete localMatrics[jambDocId];
        localStorage.setItem('sot_matric_registry', JSON.stringify(localMatrics));
      }
    }

    const localMatrics = JSON.parse(localStorage.getItem('sot_matric_registry') || '{}');
    localMatrics[matricDocId] = currentUser.uid;
    localStorage.setItem('sot_matric_registry', JSON.stringify(localMatrics));

    const updatedProfile: UserProfile = {
      ...(profile || { uid: currentUser.uid, email: currentUser.email || '', role: 'student', profileComplete: true }),
      idType: 'matric',
      matricNumber: cleanMatric,
      jambNumber: undefined,
      updatedAt: now
    };

    setProfile(updatedProfile);
    localStorage.setItem('sot_local_profile', JSON.stringify(updatedProfile));
  };

  // Login
  const login = async (email: string, password: string): Promise<UserProfile | null> => {
    const activeLock = checkLockout();
    if (activeLock) {
      throw new Error(`Login is locked due to 5 failed attempts. Please wait ${activeLock} minute(s) before trying again.`);
    }

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      localStorage.removeItem('sot_failed_attempts');
      localStorage.removeItem('sot_lockout_until');

      setUser(cred.user);
      const userProfile = await fetchUserProfile(cred.user);
      return userProfile;
    } catch (err: any) {
      const localUserRaw = localStorage.getItem('sot_local_user');
      const localProfileRaw = localStorage.getItem('sot_local_profile');
      if (localUserRaw && localProfileRaw) {
        const pUser = JSON.parse(localUserRaw);
        if (pUser.email?.toLowerCase() === email.trim().toLowerCase()) {
          localStorage.removeItem('sot_failed_attempts');
          localStorage.removeItem('sot_lockout_until');
          setUser(pUser);
          const pProfile = JSON.parse(localProfileRaw);
          setProfile(pProfile);
          return pProfile;
        }
      }

      let attempts = parseInt(localStorage.getItem('sot_failed_attempts') || '0', 10) + 1;
      localStorage.setItem('sot_failed_attempts', attempts.toString());

      if (attempts >= SITE_CONFIG.security.maxFailedAttempts) {
        const lockUntil = Date.now() + SITE_CONFIG.security.lockoutDurationMinutes * 60 * 1000;
        localStorage.setItem('sot_lockout_until', lockUntil.toString());
        setLockoutRemaining(SITE_CONFIG.security.lockoutDurationMinutes);
        throw new Error(`5 failed login attempts. Login locked for ${SITE_CONFIG.security.lockoutDurationMinutes} minutes.`);
      }

      const attemptsLeft = SITE_CONFIG.security.maxFailedAttempts - attempts;
      throw new Error(`Invalid credentials. You have ${attemptsLeft} attempt(s) remaining before a 15-minute lockout.`);
    }
  };

  // Logout
  const logout = async (): Promise<void> => {
    try {
      await fbSignOut(auth);
    } catch (e) {
      // ignore
    }
    try {
      sessionStorage.clear();
      localStorage.removeItem('sot_local_user');
      localStorage.removeItem('sot_local_profile');
      localStorage.removeItem('sot_admin_view_choice');
      localStorage.removeItem('sot_notifications_last_seen');
      localStorage.removeItem('sot_daily_ai_timestamps');
      localStorage.removeItem('sot_ai_chat_session');
    } catch (e) {
      // ignore
    }
    setUser(null);
    setProfile(null);
    setRoleReadError(null);
  };

  // Update student profile (Full Name & Password; matric number is immutable)
  const updateStudentProfile = async (fullName: string, newPassword?: string): Promise<void> => {
    if (!user) throw new Error('Not logged in');

    if (newPassword && newPassword.trim().length >= 8 && auth.currentUser) {
      await updatePassword(auth.currentUser, newPassword.trim());
    }

    if (auth.currentUser) {
      await updateDoc(doc(db, 'users', user.uid), {
        fullName: fullName.trim(),
        updatedAt: new Date().toISOString()
      });
    }

    setProfile(prev => {
      if (!prev) return null;
      const updated = {
        ...prev,
        fullName: fullName.trim(),
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('sot_local_profile', JSON.stringify(updated));
      return updated;
    });
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    await sendPasswordResetEmail(auth, email.trim());
  };

  // Case-insensitive and space-ignoring check for admin and rep roles
  const isProfileAdmin = checkIsAdminRole(profile?.role) || (profile as any)?.isAdmin === true;
  const isEmailAdmin = typeof user?.email === 'string' && user.email.trim().toLowerCase() === SITE_CONFIG.bootstrapAdminEmail.toLowerCase();
  const isAdmin = Boolean(isProfileAdmin || isEmailAdmin);
  const isRep = !isAdmin && checkIsRepRole(profile?.role);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authReady,
        isAdmin,
        isRep,
        roleReadError,
        clearRoleReadError,
        loginLockoutMinutesRemaining: lockoutRemaining,
        registerStep1,
        completeStep2,
        upgradeJambToMatric,
        login,
        logout,
        sendPasswordReset,
        updateStudentProfile,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
