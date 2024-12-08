'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function Navbar() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/'); // Redirect to home page after logout
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 p-4 flex justify-end gap-4 bg-white/80 backdrop-blur-sm border-b">
      <Link 
        href="/tabs" 
        className="px-4 py-2 rounded-md bg-black text-white hover:bg-gray-400 hover:text-black transition-colors"
      >
        Create a tab
      </Link>
      {isLoggedIn && (
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Logout
        </button>
      )}
    </nav>
  )
}
