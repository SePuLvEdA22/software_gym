export interface Client {
  id: string
  fullName: string
  documentId: string
  birthDate: string
  gender: Gender
  phone: string
  email: string
  address: string
  photo: string | null
  registrationDate: string
  accessCode: string
  status: ClientStatus
  emergencyContact: EmergencyContact
}

export type Gender = 'male' | 'female' | 'other' | 'not_specified'
export type ClientStatus = 'active' | 'inactive' | 'expired' | 'suspended'

export interface EmergencyContact {
  name: string
  phone: string
  relationship: string
  notes: string
}

export interface MembershipPlan {
  id: string
  name: string
  type: MembershipType
  price: number
  durationDays: number
  description: string
  isActive: boolean
  createdAt: string
}

export type MembershipType = 
  | 'daily' 
  | 'weekly' 
  | 'biweekly' 
  | 'monthly' 
  | 'quarterly' 
  | 'semiannual' 
  | 'annual'

export interface Membership {
  id: string
  clientId: string
  planId: string
  planName: string
  startDate: string
  endDate: string
  status: MembershipStatus
  createdAt: string
  frozenAt?: string | null
}

export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'frozen'

export interface Payment {
  id: string
  clientId: string
  membershipId: string | null
  amount: number
  method: PaymentMethod
  description: string
  date: string
  notes: string
  createdAt: string
}

export type PaymentMethod = 
  | 'cash' 
  | 'transfer' 
  | 'card' 
  | 'nequi' 
  | 'daviplata'

export interface AccessLog {
  id: string
  clientId: string
  clientName: string
  accessCode: string
  accessType: AccessType
  result: AccessResult
  message: string
  timestamp: string
}

export type AccessType = 'check_in' | 'check_out'
export type AccessResult = 'granted' | 'denied_expired' | 'denied_inactive' | 'denied_not_found' | 'denied_frozen'

export interface AccessValidation {
  valid: boolean
  client?: Client
  membership?: Membership
  message: string
  code: AccessResult
}

export interface DashboardMetrics {
  totalClients: number
  activeClients: number
  expiredClients: number
  inactiveClients: number
  todayAccesses: number
  todayRevenue: number
  monthRevenue: number
  newThisMonth: number
  peakHours: PeakHour[]
  topPlans: PlanStat[]
  recentAccesses: AccessLog[]
}

export interface PeakHour {
  hour: number
  count: number
}

export interface PlanStat {
  planName: string
  count: number
  revenue: number
}

export interface WhatsappMessage {
  id: string
  clientId: string
  clientName?: string
  phone: string
  messageType: MessageType
  message: string
  status: MessageStatus
  scheduledFor: string | null
  sentAt: string | null
  createdAt: string
}

export type MessageType = 
  | 'payment_confirmation'
  | 'expiry_reminder_3d'
  | 'expiry_reminder_1d'
  | 'expiry_reminder_same_day'
  | 'membership_expired'
  | 'welcome'

export type MessageStatus = 'pending' | 'sent' | 'failed'

export interface DoorEvent {
  id: string
  eventType: DoorEventType
  trigger: DoorEventTrigger
  timestamp: string
  notes: string
}

export type DoorEventType = 'open' | 'close' | 'denied'
export type DoorEventTrigger = 'access_code' | 'manual' | 'auto_close'
