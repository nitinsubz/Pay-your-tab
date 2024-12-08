'use client'

import { useState, useEffect } from 'react'
import { ExpenseDisplay } from '@/components/ExpenseDisplay'
import { expensesData } from '../../data/expenses'
import { useParams } from 'next/navigation'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '@/firebaseConfig'

export default function Home() {
  const [name, setName] = useState('')
  const [expenses, setExpenses] = useState<Record<string, number> | null>(null)
  const params = useParams()
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Read initial name from URL param or hash
    const urlId = params.id as string
    const hashName = window.location.hash.slice(1) // Remove the # symbol

    // First try to match the hash
    if (hashName) {
      const matchingHashName = Object.keys(expensesData).find(
        name => name.toLowerCase() === hashName.toLowerCase()
      )
      if (matchingHashName) {
        setName(matchingHashName)
        setExpenses(expensesData[matchingHashName])
      }
    } else {
      // If no hash match, try to match the URL param
      const matchingName = Object.keys(expensesData).find(
        name => name.toLowerCase() === urlId.toLowerCase()
      )
      if (matchingName) {
        setName(matchingName)
        setExpenses(expensesData[matchingName])
      }
    }

    // Always fetch tab data regardless of hash or URL param
    const fetchTabs = async () => {
      try {
        const docRef = doc(db, 'tabs', urlId);  // Always use urlId, not the hash
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const tabData = docSnap.data();
          setDescription(tabData.description || '');
          console.log(tabData);
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching document:", error);
      }
      setLoading(false);
    };

    fetchTabs();
  }, [params.id])

  // Modify the hash change effect
  useEffect(() => {
    const handleHashChange = () => {
      const hashName = window.location.hash.slice(1)
      const matchingName = Object.keys(expensesData).find(
        name => name.toLowerCase() === hashName.toLowerCase()
      )
      if (matchingName) {
        setName(matchingName)
        setExpenses(expensesData[matchingName])
        setLoading(false)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const handleNameChange = (newName: string) => {
    if (newName) {
      window.location.href = `/${newName}`
    } else {
      window.location.href = '/'
    }
  }


  useEffect(() => {
    // Update URL when name changes through select
    if (name) {
      window.location.hash = name
      setExpenses(expensesData[name])
    } else {
      window.location.hash = ''
      setExpenses(null)
    }
  }, [name])

  const getComponent = () => {
    if (loading) {
      return <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    }
    return (
      <>
        <h1 className="text-4xl font-bold mb-2">USC Weekend Expenses</h1>
        <div>
          <p className="text-sm italic text-gray-600 mb-8 text-center">
            {description}
          </p>
        </div>
        <div className="mb-8 w-full max-w-md">
          <select
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
          >
            <option value="">Select your name</option>
            {Object.keys(expensesData).map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </div>
        {expenses && <ExpenseDisplay expenses={expenses} name={name} />}
        {name && !expenses && <p className="text-red-500">No expenses found for {name}</p>}
        {!name && <p className="text-gray-500">Please select a name to view expenses</p>}
      </>
    )
  };


  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      {getComponent()}
    </main>
  )
}

