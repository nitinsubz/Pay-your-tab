'use client'

import { useState, useEffect } from 'react'
import { ExpenseDisplay } from '@/components/ExpenseDisplay'
import { expensesData } from './data/expenses'

export default function Home() {
  const [name, setName] = useState('')
  const [expenses, setExpenses] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (name) {
      setExpenses(expensesData[name])
    } else {
      setExpenses(null)
    }
  }, [name])

  
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      <h1 className="text-4xl font-bold mb-2">USC Weekend Expenses</h1>
      <p className="text-sm italic text-gray-600 mb-8">
        It's like spotify wrapped, except its the tab your broke ass ran up and now you're even more broke, wrapped.
      </p>
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
    </main>
  )
}

