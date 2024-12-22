'use client';

import { signOut } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
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
    <nav className="border-b">
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/" className="font-bold">
          PayYourTab
        </Link>
        <div className="flex gap-2">
          {pathname === '/tabs' && (
            <Link href="/tabs/new">
              <Button variant="default">Create New Tab</Button>
            </Link>
          )}
          <Link href="/tabs">
            <Button variant="outline">View All Tabs</Button>
          </Link>
          {isLoggedIn ? (
            <Button variant="ghost" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <Link href="/login">
              <Button variant="ghost">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
