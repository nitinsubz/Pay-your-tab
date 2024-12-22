import { db } from "@/lib/firebase"
import { collection, doc, getDocs, getDoc } from "firebase/firestore"

export async function getTabWithDetails(tabId: string) {
  try {
    // Get the main tab document
    const tabRef = doc(db, "tabs", tabId)
    const tabDoc = await getDoc(tabRef)

    if (!tabDoc.exists()) {
      console.log("Tab not found")
      return null
    }

    // Get participants collection
    const participantsRef = collection(db, "tabs", tabId, "participants")
    const participantsSnapshot = await getDocs(participantsRef)
    const participants = participantsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    // Get expenses collection
    const expensesRef = collection(db, "tabs", tabId, "expenses")
    const expensesSnapshot = await getDocs(expensesRef)
    const expenses = expensesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    console.log("Fetched participants:", participants) // Debug log
    console.log("Fetched expenses:", expenses) // Debug log

    return {
      ...tabDoc.data(),
      id: tabDoc.id,
      participants,
      expenses: expenses.map(expense => ({
        ...expense,
        paidBy: participants.find(p => p.id === expense.paidById),
        splitBetween: expense.splitBetweenIds
          ? expense.splitBetweenIds.map(id => 
              participants.find(p => p.id === id)
            ).filter(Boolean)
          : []
      }))
    }
  } catch (error) {
    console.error("Error fetching tab:", error)
    throw error
  }
} 