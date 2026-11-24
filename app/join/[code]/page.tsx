'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import Link from 'next/link';
import { Link2Off, Lock, Users } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Avatar, Spinner } from '@/components/app/primitives';
import { useEffectiveAuth } from '@/lib/impersonation';

export default function JoinTabPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [loading, setLoading] = useState(true);
  const [tabId, setTabId] = useState<string | null>(null);
  const [tabTitle, setTabTitle] = useState('');
  const [tabDesc, setTabDesc] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [tabOwnerId, setTabOwnerId] = useState('');
  const { effectiveUser: currentUser, ready: authReady } = useEffectiveAuth();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tabClosed, setTabClosed] = useState(false);

  useEffect(() => {
    const fetchTab = async () => {
      try {
        const q = query(collection(db, 'tabs'), where('inviteCode', '==', code));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const tabDoc = snapshot.docs[0];
        const data = tabDoc.data();
        if (data.status === 'active') {
          setTabClosed(true);
          setLoading(false);
          return;
        }
        setTabId(tabDoc.id);
        setTabTitle(data.title || 'Untitled Tab');
        setTabDesc(data.description || '');
        setMemberIds(data.memberIds || []);
        setTabOwnerId(data.userId || '');
      } catch (e) {
        console.error(e);
        setNotFound(true);
      }
      setLoading(false);
    };
    fetchTab();
  }, [code]);

  useEffect(() => {
    if (!tabId || !authReady || !currentUser) return;
    if (currentUser.uid === tabOwnerId || memberIds.includes(currentUser.uid)) {
      router.replace(`/tabs/new?editId=${tabId}`);
    }
  }, [tabId, authReady, currentUser, tabOwnerId, memberIds, router]);

  const handleJoin = async () => {
    if (!currentUser || !tabId) return;
    setJoining(true);
    setJoinError(null);
    try {
      const tabRef = doc(db, 'tabs', tabId);
      await updateDoc(tabRef, {
        [`members.${currentUser.uid}`]: {
          displayName: currentUser.displayName || currentUser.email || 'Unknown',
          email: currentUser.email || '',
          joinedAt: Timestamp.now(),
        },
        memberIds: arrayUnion(currentUser.uid),
      });
      router.push(`/tabs/new?editId=${tabId}`);
    } catch (e) {
      console.error(e);
      setJoinError('Failed to join. Please try again.');
      setJoining(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <div className="relative min-h-screen overflow-hidden tw-app-bg">
      <Navbar />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[34rem] w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 opacity-70 blur-3xl"
      />
      <main className="relative flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-16">
        <div className="tw-app-rise w-full max-w-sm">{children}</div>
      </main>
    </div>
  );

  const card = 'rounded-3xl border border-gray-100 bg-white p-8 text-center shadow-[0_16px_50px_-24px_rgba(15,23,42,0.35)]';

  if (loading || !authReady) {
    return shell(
      <div className="flex justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (notFound) {
    return shell(
      <div className={card}>
        <span className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
          <Link2Off className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">This invite link doesn&apos;t work</h1>
        <p className="mt-2 text-sm text-gray-500">It may be mistyped or expired. Ask whoever sent it for a fresh one.</p>
      </div>
    );
  }

  if (tabClosed) {
    return shell(
      <div className={card}>
        <span className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">This tab has already been sent</h1>
        <p className="mt-2 text-sm text-gray-500">It&apos;s no longer taking new collaborators. Ask the organizer to add your expenses.</p>
      </div>
    );
  }

  return shell(
    <div className={card}>
      <span className="mx-auto mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
        <Users className="h-5 w-5" />
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600">You&apos;re invited</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{tabTitle}</h1>
      {tabDesc && <p className="mt-1.5 text-sm text-gray-500">{tabDesc}</p>}
      <p className="mt-4 text-sm text-gray-500">Join to add the people and expenses you covered.</p>

      {!currentUser ? (
        <Link
          href={`/login?redirect=/join/${code}`}
          className="mt-7 flex h-12 w-full items-center justify-center rounded-full bg-gray-900 text-[15px] font-medium text-white transition-colors hover:bg-gray-800"
        >
          Sign in to join
        </Link>
      ) : (
        <>
          <div className="mt-6 flex min-w-0 items-center justify-center gap-2 text-sm text-gray-500">
            <Avatar name={currentUser.displayName || currentUser.email || '?'} size="xs" />
            <span className="shrink-0">Joining as</span> <span className="min-w-0 truncate font-medium text-gray-900">{currentUser.displayName || currentUser.email}</span>
          </div>
          {joinError && <p className="mt-3 text-sm text-red-600">{joinError}</p>}
          <button
            onClick={handleJoin}
            disabled={joining}
            className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gray-900 text-[15px] font-medium text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {joining && <Spinner className="h-4 w-4 border-[1.5px] border-white/30 border-t-white" />}
            {joining ? 'Joining…' : 'Join tab'}
          </button>
        </>
      )}
    </div>
  );
}
