// ─── Club / Platform ──────────────────────────────────────────────────────────

export interface ClubConfig {
  slug: string
  displayName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  features: ClubFeatures
}

export interface ClubFeatures {
  calendar: boolean
  mySessions: boolean
  attendance: boolean
  training: boolean
  shop: boolean
  myAccount: boolean
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: UserRole
  creditBalance: number
  profilePhotoUrl: string | null
  isActive: boolean
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export type UserRole =
  | 'cats'
  | 'member'
  | 'coach'
  | 'committee'
  | 'membership'
  | 'finance'
  | 'webmaster'
  | 'platform_admin'

// ─── Role helpers ─────────────────────────────────────────────────────────────

export const ROLE_LABELS: Record<UserRole, string> = {
  cats: 'CATS',
  member: 'Member',
  coach: 'Coach',
  committee: 'Committee',
  membership: 'Membership',
  finance: 'Finance',
  webmaster: 'Webmaster',
  platform_admin: 'Platform Admin',
}

export function isStaff(role: UserRole): boolean {
  return ['coach', 'committee', 'membership', 'finance', 'webmaster'].includes(role)
}

export function canManageSessions(role: UserRole): boolean {
  return ['coach', 'committee', 'webmaster'].includes(role)
}

export function canManageCredits(role: UserRole): boolean {
  return ['finance', 'webmaster'].includes(role)
}

export function canManageMembers(role: UserRole): boolean {
  return ['membership', 'webmaster'].includes(role)
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
  id: number
  title: string
  description: string | null
  locationId: number | null
  coachId: number | null
  startTime: string   // ISO 8601
  endTime: string
  capacity: number
  creditCost: number
  registrationCutoffHours: number
  isCancelled: boolean
  isRecurring: boolean
  recurringGroupId: string | null
  location?: Location
  coach?: AuthUser
  bookings?: SessionBooking[]
  bookedCount?: number
  isBooked?: boolean  // whether the current user is booked
}

export interface SessionBooking {
  id: number
  sessionId: number
  userId: number
  createdAt: string
  user?: AuthUser
}

export interface Location {
  id: number
  name: string
  address: string | null
  phone: string | null
  capacity: number | null
  isActive: boolean
}

// ─── Attendance ───────────────────────────────────────────────────────────────

export type AttendanceStatus = 'attended' | 'absent' | 'late' | 'noshow' | 'nsba'

export interface AttendanceRecord {
  id: number
  sessionId: number
  userId: number
  status: AttendanceStatus
  creditRefunded: boolean
  notes: string | null
  markedBy: number | null
  createdAt: string
  user?: AuthUser
}

// ─── Credits ──────────────────────────────────────────────────────────────────

export type TransactionType =
  | 'session_booking'
  | 'session_refund'
  | 'nsba_refund'
  | 'manual_add'
  | 'manual_remove'
  | 'shop_purchase'
  | 'shop_refund'
  | 'cats_initial'
  | 'payment_confirmed'

export interface CreditTransaction {
  id: number
  userId: number
  amount: number
  balanceAfter: number
  transactionType: TransactionType
  referenceId: number | null
  referenceType: string | null
  notes: string | null
  createdAt: string
  user?: AuthUser
}

// ─── Shop ─────────────────────────────────────────────────────────────────────

export interface ShopItem {
  id: number
  name: string
  description: string | null
  category: 'credits' | 'merchandise'
  imageUrl: string | null
  basePrice: number | null
  creditValue: number | null
  isActive: boolean
  displayOrder: number
  variants: ShopItemVariant[]
}

export interface ShopItemVariant {
  id: number
  shopItemId: number
  name: string
  stockQuantity: number
  additionalPrice: number
  isActive: boolean
}

export type OrderStatus =
  | 'pending'
  | 'payment_confirmed'
  | 'pending_delivery'
  | 'delivered'
  | 'cancelled'

export interface ShopOrder {
  id: number
  userId: number
  status: OrderStatus
  totalAmount: number | null
  totalCredits: number
  paymentMethod: string
  paymentReference: string | null
  paymentReceiptNumber: string | null
  paymentConfirmedAt: string | null
  fulfillmentNotes: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  createdAt: string
  items: ShopOrderItem[]
  user?: AuthUser
}

export interface ShopOrderItem {
  id: number
  orderId: number
  shopItemId: number
  variantId: number | null
  quantity: number
  unitPrice: number | null
  creditValue: number
  itemNameSnapshot: string | null
}

// ─── Training ─────────────────────────────────────────────────────────────────

export interface TrainingMetric {
  id: number
  name: string
  unit: string
  category: string | null
  displayOrder: number
  isActive: boolean
}

export interface MemberTime {
  id: number
  userId: number
  metricId: number
  value: string
  updatedBy: number | null
  updatedAt: string
  metric?: TrainingMetric
}

export interface SwimSet {
  id: number
  title: string
  description: string | null
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: 'sprint' | 'endurance' | 'technique' | 'im' | 'other'
  content: string
  totalDistance: number | null
  isSetOfWeek: boolean
  isActive: boolean
  createdAt: string
}

export interface TrainingVideo {
  id: number
  title: string
  description: string | null
  category: 'drills' | 'strength' | 'stretches'
  youtubeUrl: string
  thumbnailUrl: string | null
  isActive: boolean
}

// ─── Member management ────────────────────────────────────────────────────────

export interface Member extends AuthUser {
  phone: string | null
  dateOfBirth: string | null
  memberNumber: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  lastLoginAt: string | null
  createdAt: string
}

// ─── CATS signup ──────────────────────────────────────────────────────────────

export interface CatsFormField {
  fieldKey: string
  fieldLabel: string
  fieldType: 'text' | 'boolean' | 'select' | 'number'
  fieldOptions: string[] | null
  isRequired: boolean
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ApiError {
  error: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface TransactionResponse {
  id: number
  userId: number
  userFullName: string | null
  amount: number
  balanceAfter: number
  transactionType: TransactionType
  transactionLabel: string
  referenceId: number | null
  referenceType: string | null
  notes: string | null
  createdAt: string
}

export interface MyAccountResponse {
  creditBalance: number
  pendingCredits: number
  recentTransactions: TransactionResponse[]
}

export interface AdjustCreditsRequest {
  userId: number
  amount: number
  notes: string
}

export interface CreditBalanceResponse {
  userId: number
  fullName: string
  balance: number
  pendingCredits: number
}

export interface MemberStatsResponse {
  totalMembers: number
  activeMembers: number
  lowCreditMembers: number
  noCreditsMembers: number
}

// ─── Member management ─────────────────────────────────────────────────────

export interface MemberListResponse {
  id: number
  email: string
  firstName: string
  lastName: string
  fullName: string
  role: UserRole
  roleLabel: string
  creditBalance: number
  phone: string | null
  memberNumber: string | null
  profilePhotoUrl: string | null
  isActive: boolean
  createdAt: string
  upcomingSessionCount: number
}

export interface MemberDetailResponse {
  id: number
  email: string
  firstName: string
  lastName: string
  role: string
  roleLabel: string
  creditBalance: number
  phone: string | null
  memberNumber: string | null
  profilePhotoUrl: string | null
  dateOfBirth: DateOnly | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

type DateOnly = string  // ISO date string "YYYY-MM-DD"

// ─── My Account ───────────────────────────────────────────────────────────────

export interface MyAccountResponse {
  creditBalance: number
  pendingCredits: number
  recentTransactions: TransactionResponse[]
}

export interface AdjustCreditsRequest {
  userId: number
  amount: number
  notes: string
}