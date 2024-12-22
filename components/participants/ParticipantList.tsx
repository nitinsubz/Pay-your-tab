import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Participant } from '@/types'

interface ParticipantListProps {
  participants: Participant[]
  onParticipantsChange: (participants: Participant[]) => void
}

export function ParticipantList({ participants, onParticipantsChange }: ParticipantListProps) {
  const addParticipant = () => {
    const newParticipant: Participant = {
      id: crypto.randomUUID(),
      name: '',
      paid: false
    }
    onParticipantsChange([...participants, newParticipant])
  }

  const updateParticipant = (index: number, updates: Partial<Participant>) => {
    const newParticipants = [...participants]
    newParticipants[index] = {
      ...newParticipants[index],
      ...updates,
      id: updates.phoneNumber || newParticipants[index].id
    }
    onParticipantsChange(newParticipants)
  }

  const togglePaidStatus = (participantId: string) => {
    onParticipantsChange(
      participants.map(p => 
        p.id === participantId 
          ? { ...p, paid: !p.paid }
          : p
      )
    )
  }

  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold mb-4">Participants</h2>
      <div className="grid gap-2">
        {participants.map((participant) => (
          <div 
            key={participant.id} 
            className={`flex justify-between items-center p-2 border rounded ${
              participant.paid ? 'bg-green-50' : ''
            }`}
          >
            <span>{participant.name}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => togglePaidStatus(participant.id)}
            >
              {participant.paid ? 'Mark as Unpaid' : 'Mark as Paid'}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  )
} 