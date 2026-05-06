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
import { db, auth } from '@/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import Link from 'next/link';

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [tabClosed, setTabClosed] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

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

  if (loading || !authReady) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Invalid invite link</h1>
          <p className="text-gray-600">This invite link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (tabClosed) {
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Tab already finalized</h1>
          <p className="text-gray-600">This tab has been created and is no longer accepting new members.</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-1">
          You&apos;re invited
        </p>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{tabTitle}</h1>
        {tabDesc && <p className="text-sm text-gray-600 mb-6">{tabDesc}</p>}
        {!tabDesc && <div className="mb-6" />}

        {!currentUser ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Sign in to join this tab and add expenses.</p>
            <Link
              href={`/login?redirect=/join/${code}`}
              className="block w-full text-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              Sign in to join
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Joining as{' '}
              <span className="font-medium">
                {currentUser.displayName || currentUser.email}
              </span>
            </p>
            {joinError && <p className="text-red-600 text-sm">{joinError}</p>}
            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
            >
              {joining ? 'Joining...' : 'Join tab'}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
