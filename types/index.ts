export interface FirestoreParticipant {
  phoneNumber: string
  name: string
}

export interface Participant extends FirestoreParticipant {
  id: string
}

export interface FirestoreTabData {
  createdAt: {
    seconds: number
    nanoseconds: number
  }
  description: string
  items: any[]
  people: FirestoreParticipant[]
  status: 'active' | 'closed'
  title: string
  userId: string
}

export interface TabData {
  participants: Participant[]
  expenses: ExpenseWithDetails[]
}

export interface ExpenseWithDetails {
  id: string
  description: string
  amount: number
  paidBy: Participant
  paidById: string
  splitBetween: Participant[]
  splitBetweenIds: string[]
} 