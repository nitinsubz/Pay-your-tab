'use client';

import { useState } from "react";
import { loginWithGoogle, logout } from "@/lib/authutils";
import { User } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  const handleLogin = async () => {
    const { success, user, error } = await loginWithGoogle();
    if (success && user) {
      setUser(user);
      router.push('/tabs'); 
    } else {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    const { success, error } = await logout();
    if (success) {
      setUser(null);
    } else {
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        {user ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {user.displayName}</h1>
            <p className="text-gray-600">{user.email}</p>
            <button
              onClick={handleLogout}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold text-gray-900">Sign in to your account</h2>
              <p className="mt-2 text-sm text-gray-600">
                Please sign in with your Google account to continue
              </p>
            </div>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Image
                src="/google.svg"
                alt="Google logo"
                width={20}
                height={20}
              />
              Sign in with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
