import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/firebaseConfig"
import { doc, updateDoc, getDoc } from "firebase/firestore"

interface ExpenseDisplayProps {
  expenses: Record<string, number>
  name: string
  isPaid?: boolean
  onMarkPaid?: () => void
  documentId: string
}

export function ExpenseDisplay({ expenses, name, isPaid = false, onMarkPaid, documentId }: ExpenseDisplayProps) {
  let total = Object.values(expenses).reduce((sum, expense) => sum + expense, 0)

  const formatAmount = (amount: number) => {
    return amount < 0 
      ? `-$${Math.abs(amount).toFixed(2)}`
      : `$${amount.toFixed(2)}`
  }

  const handleMarkPaid = async () => {
    try {
      const expenseRef = doc(db, "tabs", documentId)
      
      // First get the current document data
      const docSnap = await getDoc(expenseRef)
      const currentData = docSnap.data()
      
      if (!currentData?.people) {
        throw new Error("Invalid document structure")
      }

      // Create a new people array with the updated paid status
      const updatedPeople = [...currentData.people]
      const personIndex = updatedPeople.findIndex(person => person.name === name)
      
      if (personIndex === -1) {
        throw new Error("Person not found in the tab")
      }

      // Update the specific person while preserving their other data
      updatedPeople[personIndex] = {
        ...updatedPeople[personIndex],
        paid: true
      }

      // Update the document with the entire new people array
      await updateDoc(expenseRef, {
        people: updatedPeople
      })
      
      if (onMarkPaid) {
        onMarkPaid()
      }
    } catch (error) {
      console.error("Error marking as paid:", error)
      alert("Failed to mark as paid. Please try again.")
    }
  }

  // Helper function to find the person's index
  const findPersonIndex = async (docRef: any, personName: string) => {
    const doc = await getDoc(docRef)
    const people = (doc.data() as any).people || []
    return people.findIndex((person: any) => person.name === personName)
  }
  
  return (
    <Card className={`w-full max-w-md ${isPaid ? 'bg-green-50' : ''}`}>
      <CardHeader>
        <CardTitle>{name}&apos;s Expenses</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {Object.entries(expenses).map(([category, amount]) => (
            <li 
              key={category} 
  className={`flex justify-between ${amount < 0 ? 'text-blue-600' : ''}`}
  >
              <span>{category}</span>
              <span>{formatAmount(amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-xl font-bold flex justify-between">
          <span>Total</span>
          <span>{formatAmount(total)}</span>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {!isPaid ? (
          <>
            {total > 0 && (
              <Button className="w-full" onClick={() => window.location.href = `venmo://paycharge?txn=pay&recipients=nitinsub&amount=${total.toFixed(2)}&note=USC WEEKEND`}>
                Click to Venmo
              </Button>
            )}
            {total <= 0 && (
              <Button className="w-full" onClick={() => window.location.href = `venmo://paycharge?txn=req&recipients=nitinsub&amount=${(-total).toFixed(2)}&note=USC WEEKEND REIMBURSEMENT`}>
                Click to Venmo Request
              </Button>
            )}
            <Button variant="outline" className="w-full" onClick={handleMarkPaid}>
              Mark as Paid
            </Button>
          </>
        ) : (
          <div className="text-center text-green-600 font-medium">
            Paid ✓
          </div>
        )}
      </CardFooter>
    </Card>
  )
}

