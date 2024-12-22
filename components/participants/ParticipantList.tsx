import { Card } from '@/components/ui/card'
import type { Participant } from '@/types'

interface ParticipantListProps {
  participants: Participant[]
}

export function ParticipantList({ participants }: ParticipantListProps) {
  return (
    <Card className="p-4">
      <h2 className="text-xl font-semibold mb-4">Participants</h2>
      <div className="grid gap-2">
        {participants.map((participant) => (
          <div key={participant.id} className="flex justify-between items-center p-2 border rounded">
            <span>{participant.name}</span>
          </div>
        ))}
      </div>
    </Card>
  )
} 