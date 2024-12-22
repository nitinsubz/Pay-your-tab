import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Participant, ExpenseWithDetails } from '@/types'

interface ExpenseItemProps {
  expense: ExpenseWithDetails
  participants: Participant[]
  onChange: (expense: ExpenseWithDetails) => void
  onParticipantPaidChange: (participantId: string, paid: boolean) => void
}

export function ExpenseItem({ 
  expense, 
  participants, 
  onChange,
  onParticipantPaidChange 
}: ExpenseItemProps) {
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
        className={`border rounded p-2 ${
          participants.find(p => p.id === expense.paidById)?.paid 
            ? 'bg-green-100' 
            : ''
        }`}
      >
        {participants.map(participant => (
          <option 
            key={participant.id} 
            value={participant.id}
            className={participant.paid ? 'bg-green-100' : ''}
          >
            {participant.name} {participant.paid ? '(Paid)' : ''}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          const participant = participants.find(p => p.id === expense.paidById)
          if (participant) {
            onParticipantPaidChange(participant.id, !participant.paid)
          }
        }}
      >
        Mark as {participants.find(p => p.id === expense.paidById)?.paid ? 'Unpaid' : 'Paid'}
      </Button>
    </div>
  )
} 