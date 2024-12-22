import { Input } from '@/components/ui/input'
import type { Participant, ExpenseWithDetails } from '@/types'

interface ExpenseItemProps {
  expense: ExpenseWithDetails
  participants: Participant[]
  onChange: (expense: ExpenseWithDetails) => void
}

export function ExpenseItem({ expense, participants, onChange }: ExpenseItemProps) {
  return (
    <div className="flex gap-4 items-center">
      <Input 
        value={expense.description}
        onChange={(e) => onChange({ ...expense, description: e.target.value })}
        placeholder="Description"
      />
      <Input 
        type="number"
        value={expense.amount}
        onChange={(e) => onChange({ ...expense, amount: parseFloat(e.target.value) || 0 })}
        placeholder="Amount"
      />
      <select 
        value={expense.paidById}
        onChange={(e) => {
          const paidBy = participants.find(p => p.id === e.target.value)
          if (paidBy) {
            onChange({ ...expense, paidBy, paidById: paidBy.id })
          }
        }}
        className="border rounded p-2"
      >
        {participants.map(participant => (
          <option key={participant.id} value={participant.id}>
            {participant.name}
          </option>
        ))}
      </select>
    </div>
  )
} 