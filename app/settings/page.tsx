'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [venmoUsername, setVenmoUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSetup, setIsSetup] = useState(false);

  useEffect(() => {
    // Check if this is a setup flow
    const urlParams = new URLSearchParams(window.location.search);
    setIsSetup(urlParams.get('setup') === 'true');

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }
      
      setUser(currentUser);
      
      // Load user profile
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setVenmoUsername(userData.venmoUsername || '');
        }
      } catch (error) {
        console.error('Error loading user profile:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;

    if (!venmoUsername.trim()) {
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
        venmoUsername: venmoUsername.trim(),
        updatedAt: serverTimestamp(),
        email: user.email,
        displayName: user.displayName
      };
      
      // Only include createdAt for new users
      if (isNewUser) {
        userData.createdAt = serverTimestamp();
      }
      
      await setDoc(userRef, userData, { merge: true });

      setMessage({ type: 'success', text: 'Venmo username saved successfully!' });
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        {isSetup && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">Welcome! Let&apos;s get started</h2>
            <p className="text-sm text-blue-800">
              Please set your Venmo username to continue. This will be used automatically when creating tabs.
            </p>
          </div>
        )}
        <h1 className="text-3xl font-bold mb-8">Settings</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full rounded-md border-gray-300 bg-gray-50 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Venmo Username *
                </label>
                <input
                  type="text"
                  value={venmoUsername}
                  onChange={(e) => setVenmoUsername(e.target.value)}
                  placeholder="@username"
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This will be used automatically when creating new tabs
                </p>
              </div>
            </div>
          </div>

          {message && (
            <div className={`p-4 rounded-md ${
              message.type === 'success' 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {message.text}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={saving || !venmoUsername.trim()}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

