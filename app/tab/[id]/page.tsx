'use client'

import { useState, useEffect } from 'react'
import { ExpenseDisplay } from '@/components/ExpenseDisplay'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '@/firebaseConfig'
import { useParams } from 'next/navigation'

interface Person {
  name: string;
  phoneNumber: string;
  paid?: boolean;
}

interface Item {
  name: string;
  splits: {
    amount: number;
    personName: string;
  }[];
  totalAmount: number;
}

interface TabDocument {
  people: Person[];
  title: string;
  description: string;
  items: Item[];
}

export default function Home() {
  const [name, setName] = useState('')
  const [expenses, setExpenses] = useState<Record<string, number> | null>(null)
  const params = useParams()
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [tabExists, setTabExists] = useState(true);
  const [title, setTitle] = useState('');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [expensesData, setExpensesData] = useState<Record<string, Record<string, number>>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [paid, setPaid] = useState(false);
  const [paidStatusCache, setPaidStatusCache] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const urlId = params.id as string
    const hashName = window.location.hash.slice(1)

    const fetchTabAndExpenses = async () => {
      try {
        const tabDocRef = doc(db, 'tabs', urlId);
        const tabDocSnap = await getDoc(tabDocRef);
        const tabData = tabDocSnap.data() as TabDocument;

        if (tabDocSnap.exists()) {
          setDescription(tabData.description || '');
          setTitle(tabData.title);
          setPeople(tabData.people || []);
          setItems(tabData.items || []);
          setTabExists(true);

          // Calculate expenses per person
          const expensesMap: Record<string, Record<string, number>> = {};
          
          // Initialize expenses map for each person
          tabData.people.forEach((person: Person) => {
            expensesMap[person.name] = {};
          });

          // Calculate expenses from items
          tabData.items.forEach((item: Item) => {
            item.splits.forEach((split) => {
              if (expensesMap[split.personName]) {
                expensesMap[split.personName][item.name] = split.amount;
              }
            });
          });

          setExpensesData(expensesMap);
          setAllUsers(tabData.people.map((p: Person) => p.name));

          // Initialize paid status cache
          const initialPaidStatus: Record<string, boolean> = {};
          tabData.people.forEach((person: Person) => {
            initialPaidStatus[person.name] = person.paid || false;
          });
          setPaidStatusCache(initialPaidStatus);

          // Set expenses based on hash
          if (hashName) {
            const matchingHashName = tabData.people.find(
              (p: Person) => p.name.toLowerCase() === hashName.toLowerCase()
            )?.name;
            if (matchingHashName && expensesMap[matchingHashName]) {
              setName(matchingHashName);
              setExpenses(expensesMap[matchingHashName]);
            }
          }
        } else {
          setTabExists(false);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        setTabExists(false);
      }
      setLoading(false);
    };
    console.log(paid);
    fetchTabAndExpenses();
  }, [params.id]);

  // Modify the hash change effect to use expensesData from state
  useEffect(() => {
    const handleHashChange = () => {
      const hashName = window.location.hash.slice(1)
      if (expensesData) {  // Add check for expensesData
        const matchingName = Object.keys(expensesData).find(
          name => name.toLowerCase() === hashName.toLowerCase()
        )
        if (matchingName) {
          setName(matchingName)
          setExpenses(expensesData[matchingName])
          setLoading(false)
        }
      }
    }
    
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [expensesData])  // Add expensesData as dependency
  
  useEffect(() => {
    if (name && expensesData) {
      window.location.hash = name
      setExpenses(expensesData[name])
      setPaid(paidStatusCache[name] || false);
    } else {
      window.location.hash = ''
      setExpenses(null)
    }
  }, [name, expensesData, paidStatusCache])

  const getComponent = () => {
    if (loading) {
      return <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    }
    
    if (!tabExists) {
      return (
        <>
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">Oops!</h1>
          <p className="text-xl text-gray-600">This tab does not exist.</p>
        </div>
        </>
      );
    }

    return (
      <>
        <h1 className="text-4xl font-bold mb-2 text-center">{title}</h1>
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
            {allUsers.map((person) => (
              <option key={person} value={person}>
                {person}
              </option>
            ))}
          </select>
        </div>
        {expenses && (
          <ExpenseDisplay 
            expenses={expenses} 
            name={name} 
            documentId={params.id as string}
            isPaid={paid}
            onMarkPaid={() => {
              setPaid(true);
              setPaidStatusCache(prev => ({
                ...prev,
                [name]: true
              }));
            }}
          />
        )}
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

