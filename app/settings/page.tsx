'use client';

import { useState, useEffect } from 'react';
import { db } from '@/firebaseConfig';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import Link from 'next/link';
import { ArrowLeft, AtSign, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, Field, Panel, Spinner, inputClass } from '@/components/app/primitives';
import { cn } from '@/lib/utils';
import { useEffectiveAuth } from '@/lib/impersonation';

export default function SettingsPage() {
  const router = useRouter();
  const { authUser, effectiveUser, ready } = useEffectiveAuth();
  const user = effectiveUser;
  const [venmoUsername, setVenmoUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSetup, setIsSetup] = useState(false);

  const effectiveUid = effectiveUser?.uid;

  useEffect(() => {
    // Check if this is a setup flow
    const urlParams = new URLSearchParams(window.location.search);
    setIsSetup(urlParams.get('setup') === 'true');
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!authUser || !effectiveUid) {
      router.push('/login');
      return;
    }

    const loadProfile = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, 'users', effectiveUid);
        const userSnap = await getDoc(userRef);

        setVenmoUsername(userSnap.exists() ? userSnap.data().venmoUsername || '' : '');
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [ready, authUser, effectiveUid, router]);

  const handleSave = async () => {
    if (!user) return;

    const cleanVenmo = venmoUsername.trim().replace(/^@+/, '');
    if (!cleanVenmo) {
      setMessage({ type: 'error', text: 'Venmo username is required' });
      return;
    }

    try {
      setSaving(true);
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const isNewUser = !userSnap.exists();
      
      interface UserData {
        venmoUsername: string;
        updatedAt: ReturnType<typeof serverTimestamp>;
        email: string | null | undefined;
        displayName: string | null | undefined;
        createdAt?: ReturnType<typeof serverTimestamp>;
      }
      
      const userData: UserData = {
        venmoUsername: cleanVenmo,
        updatedAt: serverTimestamp(),
        email: user.email,
        displayName: user.displayName
      };
      
      // Only include createdAt for new users
      if (isNewUser) {
        userData.createdAt = serverTimestamp();
      }
      
      await setDoc(userRef, userData, { merge: true });
      setVenmoUsername(cleanVenmo);

      setMessage({ type: 'success', text: isSetup ? 'Saved. Taking you to your tabs…' : 'Saved' });
      setTimeout(() => {
        setMessage(null);
        if (isSetup) {
          router.push('/tabs');
        }
      }, 2000);
    } catch (error) {
      console.error('Error saving venmo username:', error);
      setMessage({ type: 'error', text: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen tw-app-bg">
        <Navbar />
        <main className="flex min-h-[60vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </main>
      </div>
    );
  }

  const name = user?.displayName || user?.email || 'You';

  return (
    <div className="min-h-screen tw-app-bg">
      <Navbar />
      <main className="tw-app-rise mx-auto max-w-xl px-4 pb-24 pt-8 sm:pt-12">
        {isSetup ? (
          <div className="mb-8 text-center">
            <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#008CFF] text-white shadow-[0_10px_24px_-12px_rgba(0,140,255,0.8)]">
              <AtSign className="h-5 w-5" />
            </span>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-gray-900">One last thing</h1>
            <p className="mx-auto mt-2 max-w-sm text-[15px] text-gray-500">
              What&apos;s your Venmo username? Every tab you send uses it, so friends can pay you in one tap.
            </p>
          </div>
        ) : (
          <div className="mb-8">
            <Link
              href="/tabs"
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 transition-colors hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              My tabs
            </Link>
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-gray-900">Settings</h1>
          </div>
        )}

        <Panel className="overflow-hidden">
          {!isSetup && (
            <div className="flex items-center gap-4 border-b border-gray-100 px-6 py-5">
              <Avatar name={name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-gray-900">{user?.displayName || 'Your account'}</p>
                <p className="truncate text-sm text-gray-400">{user?.email}</p>
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                Google
              </span>
            </div>
          )}

          <form
            className="space-y-5 px-6 py-6"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Field
              label="Venmo username"
              htmlFor="venmo"
              hint="Prefilled on everyone's Venmo button when you send a tab. New tabs use it automatically."
            >
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] text-gray-400">@</span>
                <input
                  id="venmo"
                  type="text"
                  value={venmoUsername}
                  onChange={(e) => setVenmoUsername(e.target.value.replace(/^\s*@+/, ''))}
                  placeholder="your-username"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  autoFocus={isSetup}
                  className={cn(inputClass, 'pl-8')}
                />
              </div>
            </Field>

            {message && (
              <div
                role="status"
                className={cn(
                  'flex items-center gap-2 rounded-2xl px-4 py-3 text-sm',
                  message.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800'
                    : 'bg-red-50 text-red-700'
                )}
              >
                {message.type === 'success' && <Check className="h-4 w-4" strokeWidth={3} />}
                {message.text}
              </div>
            )}

            <div className="flex justify-end">
              <Button type="submit" disabled={saving || !venmoUsername.trim().replace(/^@+/, '')} className={cn(isSetup && 'w-full')} size={isSetup ? 'lg' : 'default'}>
                {saving ? 'Saving…' : isSetup ? 'Continue' : 'Save'}
              </Button>
            </div>
          </form>
        </Panel>
      </main>
    </div>
  );
}
