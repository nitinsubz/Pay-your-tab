'use client';

import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

/**
 * Accounts allowed to view the app as any other user. Must match the list in
 * firestore.rules — the rules are what actually enforce access.
 */
export const SUPERADMIN_EMAILS = ['nitins@g.ucla.edu'];

const STORAGE_KEY = 'tabwrapped:viewAs';

export interface ImpersonationTarget {
  uid: string;
  email: string | null;
  displayName: string | null;
}

export interface EffectiveUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  /** True when this identity came from a superadmin "view as", not from sign-in. */
  isImpersonating: boolean;
}

export function isSuperAdmin(user: User | { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && SUPERADMIN_EMAILS.includes(email);
}

/** `undefined` means "not hydrated from localStorage yet". */
let cachedTarget: ImpersonationTarget | null | undefined = undefined;
const listeners = new Set<() => void>();

function readTarget(): ImpersonationTarget | null {
  if (typeof window === 'undefined') return null;
  if (cachedTarget !== undefined) return cachedTarget;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as ImpersonationTarget) : null;
    cachedTarget = parsed && typeof parsed.uid === 'string' ? parsed : null;
  } catch {
    cachedTarget = null;
  }
  return cachedTarget;
}

export function getImpersonationTarget(): ImpersonationTarget | null {
  return readTarget();
}

export function setImpersonationTarget(target: ImpersonationTarget | null): void {
  cachedTarget = target;
  if (typeof window !== 'undefined') {
    try {
      if (target) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(target));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* storage unavailable — impersonation just won't survive a reload */
    }
  }
  listeners.forEach((listener) => listener());
}

export function subscribeToImpersonation(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * The identity the app should act as: the impersonated user when a superadmin
 * is viewing as someone else, otherwise the signed-in user. Imperative variant
 * for callbacks and effects — mirrors `auth.currentUser`, so call sites that
 * used that can swap in this instead.
 */
export function getEffectiveUser(): EffectiveUser | null {
  const authUser = auth.currentUser;
  if (!authUser) return null;

  const target = readTarget();
  if (target && isSuperAdmin(authUser)) {
    return { ...target, isImpersonating: true };
  }

  return {
    uid: authUser.uid,
    email: authUser.email,
    displayName: authUser.displayName,
    isImpersonating: false,
  };
}

export interface EffectiveAuthState {
  /** The real signed-in account, never the impersonated one. */
  authUser: User | null;
  /** The identity to read and write data as. Null until auth resolves. */
  effectiveUser: EffectiveUser | null;
  /** Convenience: `effectiveUser?.uid`. */
  effectiveUid: string | null;
  /** False until the first `onAuthStateChanged` callback fires. */
  ready: boolean;
  isSuperAdmin: boolean;
  impersonating: ImpersonationTarget | null;
  startImpersonating: (target: ImpersonationTarget) => void;
  stopImpersonating: () => void;
}

export function useEffectiveAuth(): EffectiveAuthState {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [target, setTarget] = useState<ImpersonationTarget | null>(null);

  useEffect(() => {
    setTarget(readTarget());
    return subscribeToImpersonation(() => setTarget(readTarget()));
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      // Never carry a "view as" across a sign-out.
      if (!user) setImpersonationTarget(null);
      setAuthUser(user);
      setReady(true);
    });
  }, []);

  const admin = isSuperAdmin(authUser);
  const impersonating = admin ? target : null;

  const startImpersonating = useCallback((next: ImpersonationTarget) => {
    setImpersonationTarget(next);
  }, []);

  const stopImpersonating = useCallback(() => {
    setImpersonationTarget(null);
  }, []);

  const effectiveUser: EffectiveUser | null = !authUser
    ? null
    : impersonating
      ? { ...impersonating, isImpersonating: true }
      : {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName,
          isImpersonating: false,
        };

  return {
    authUser,
    effectiveUser,
    effectiveUid: effectiveUser?.uid ?? null,
    ready,
    isSuperAdmin: admin,
    impersonating,
    startImpersonating,
    stopImpersonating,
  };
}
