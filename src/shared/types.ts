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

export interface Promotion {
  id: string
  name: string
  planId: string
  discountType: 'percentage' | 'fixed'
  discountValue: number
  startDate: string
  endDate: string
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
  freezeReason?: string | null
  freezeDays?: number | null
}

export interface FreezeHistory {
  id: string
  membershipId: string
  clientId: string
  frozenAt: string
  unfrozenAt: string | null
  reason: string | null
  plannedDays: number | null
  actualDays: number | null
}

export type MembershipStatus = 'active' | 'expired' | 'cancelled' | 'frozen'

export interface Payment {
  id: string
  clientId: string
  clientName?: string
  membershipId: string | null
  amount: number
  discount: number
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
  debtorsCount: number
  inactiveClientsCount: number
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

export interface ClientDebt {
  clientId: string
  clientName: string
  clientPhone: string
  membershipId: string
  planName: string
  totalDue: number
  totalPaid: number
  balance: number
  endDate: string
  status: string
}

export interface DebtorSummary {
  clientId: string
  clientName: string
  phone: string
  balance: number
}

export interface ClientAttendanceStats {
  totalVisits: number
  lastVisit: string | null
  firstVisit: string | null
  daysAttendedThisMonth: number
}

export interface InactiveClient {
  clientId: string
  clientName: string
  phone: string
  planName: string
  lastVisit: string | null
  daysSinceLastVisit: number
}

export interface RevenueByPeriod {
  morning: number
  afternoon: number
  total: number
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

export type UserRole = 'admin' | 'reception' | 'trainer' | 'accounting'

export interface User {
  id: string
  username: string
  fullName: string
  role: UserRole
  permissions: string[]
  isActive: boolean
  lastLogin: string | null
  createdAt: string
  updatedAt: string
}

export interface UserWithPassword extends User {
  passwordHash: string
}

export interface ChangeLog {
  id: string
  userId: string | null
  userName: string
  tableName: string
  recordId: string
  action: 'create' | 'update' | 'delete'
  oldValues: string | null
  newValues: string | null
  timestamp: string
}

export interface Product {
  id: string
  name: string
  category: 'supplement' | 'drink' | 'accessory' | 'other'
  description: string
  price: number
  cost: number
  stock: number
  minStock: number
  barcode: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface InventoryMovement {
  id: string
  productId: string
  productName: string
  type: 'in' | 'out'
  quantity: number
  price: number
  total: number
  description: string
  userId: string | null
  userName: string
  timestamp: string
}

export interface BodyMeasurement {
  id: string
  clientId: string
  date: string
  weight: number | null
  height: number | null
  neck: number | null
  shoulders: number | null
  chest: number | null
  leftArm: number | null
  rightArm: number | null
  waist: number | null
  hips: number | null
  leftThigh: number | null
  rightThigh: number | null
  leftCalf: number | null
  rightCalf: number | null
  bodyFat: number | null
  notes: string
}

export type FitnessGoal = 'lose_weight' | 'gain_muscle' | 'define' | 'maintain'

export interface ClientGoal {
  id: string
  clientId: string
  goal: FitnessGoal
  startDate: string
  targetDate: string | null
  notes: string
  isActive: boolean
  createdAt: string
}

export interface MessageTemplate {
  id: string
  name: string
  type: 'email' | 'whatsapp'
  subject: string
  content: string
  variables: string[]
  createdAt: string
}

export interface PasswordReset {
  id: string
  userId: string
  token: string
  expiresAt: string
  usedAt: string | null
  createdAt: string
}

export interface ClientNumberSeq {
  id: number
  lastNumber: number
}

declare global {
  interface Window {
    electronAPI: any
    __CURRENT_USER__?: User
  }
}
