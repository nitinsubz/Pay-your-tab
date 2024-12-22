import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExpenseItem } from '@/components/expenses/ExpenseItem'
import type { Participant, ExpenseWithDetails } from '@/types'

interface ExpenseListProps {
  expenses: ExpenseWithDetails[]
  participants: Participant[]
  onExpensesChange: (expenses: ExpenseWithDetails[]) => void
  onParticipantPaidChange: (participantId: string, paid: boolean) => void
}

export function ExpenseList({ expenses, participants, onExpensesChange, onParticipantPaidChange }: ExpenseListProps) {
  const addExpense = () => {
    if (participants.length === 0) return

    const newExpense: ExpenseWithDetails = {
      id: crypto.randomUUID(),
      description: '',
      amount: 0,
      paidBy: participants[0],
      splitBetween: [...participants],
      paidById: participants[0].id,
      splitBetweenIds: participants.map(p => p.id)
    }

    onExpensesChange([...expenses, newExpense])
  }

  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold mb-4">Expenses</h2>
      <Button onClick={addExpense} className="mb-4">Add Expense</Button>
      
      <div className="grid grid-cols-1 gap-4">
        {expenses.map((expense) => (
          <ExpenseItem
            key={expense.id}
            expense={expense}
            participants={participants}
            onChange={(updatedExpense) => {
              onExpensesChange(
                expenses.map(exp => exp.id === updatedExpense.id ? updatedExpense : exp)
              )
            }}
            onParticipantPaidChange={onParticipantPaidChange}
          />
        ))}
      </div>
    </Card>
  )
} 