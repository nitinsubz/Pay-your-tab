'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/firebaseConfig';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { Navbar } from '@/components/Navbar';
import { useRouter } from 'next/navigation';
import { sendSMS } from '@/api/sms/sendSMS';


export default function TabsDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [tabs, setTabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }
      
      setUser(currentUser);
      console.log(currentUser.uid);
      // Fetch user's tabs
      const tabsRef = collection(db, 'tabs');
      const q = query(tabsRef, where('userId', '==', currentUser.uid));
      const querySnapshot = await getDocs(q);
      const userTabs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTabs(userTabs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>;
  }

  const handTextBlast = () => {
    sendSMS({message: "hey", recipients: ['4084976281']});
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">
          Welcome, {user?.displayName || user?.email}
        </h1>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Your Tabs</h2>
          {tabs.length === 0 ? (
            <p className="text-gray-500">You have not created any tabs yet.</p>
          ) : (
            <ul className="space-y-4">
              {tabs.map((tab) => (
                <li key={tab.id} className="border-b pb-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-medium">{tab.title}</h3>
                    <p className="text-gray-600">{tab.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push(`/tab/${tab.id}`)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors duration-200 flex items-center gap-2"
                    >
                      View Tab
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
