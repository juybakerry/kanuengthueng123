/**
 * ชนิดข้อมูลกลาง ใช้ร่วมกันระหว่างแอป (src/) และเซิร์ฟเวอร์ (worker/)
 * เงินทุกจำนวนเป็น "สตางค์" (integer) · วันที่เข้าพักเป็น 'YYYY-MM-DD' ตามเวลาไทย
 */
export type ISODate = string;
export type Satang = number;

export type RoomKind = 'small' | 'large';
export type Channel = 'facebook' | 'line' | 'phone' | 'walk_in' | 'online' | 'other';
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show';
export type PayStatus = 'unpaid' | 'deposit' | 'paid';
export type PayMethod = 'transfer' | 'promptpay' | 'cash';
export type PaymentKind = 'deposit' | 'balance' | 'refund' | 'other';
export type IssueStatus = 'open' | 'in_progress' | 'done';
export type BookingMode = 'both' | 'room' | 'person';
/** วิธีคิดมัดจำ: % ของยอดรวม · จำนวนเงินต่อการจอง · จำนวนเงินต่อคน */
export type DepositMode = 'percent' | 'booking' | 'person';

export interface Base {
  id: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

export interface HomestayInfo {
  name: string;
  shortName: string;
  address: string;
  phone: string;
  lineId: string;
  facebook: string;
  instagram: string;
  tagline: string;
}

export interface Settings {
  pricePerPerson: Satang;
  depositMode: DepositMode;
  /** ใช้เมื่อ depositMode = 'percent' */
  depositPct: number;
  /** ใช้เมื่อ depositMode = 'booking' | 'person' (สตางค์) — มัดจำไม่เกินยอดรวม */
  depositAmount: Satang;
  depositDueDays: number;
  mealCost: Satang;
  housekeepingCost: Satang;
  transportCost: Satang;
  checkInTime: string;
  checkOutTime: string;
  promptpayId: string;
  promptpayName: string;
  bankAccount: string;
  bookingMode: BookingMode;
  rescheduleLimit: number;
  cancelForfeitsDeposit: boolean;
  transportTimes: string[];
  notifyMorningHour: number;
  notifyEveningHour: number;
  lineDigest: boolean;
  publicBooking: boolean;
  homestay: HomestayInfo;
}

export interface Room extends Base {
  name: string;
  kind: RoomKind;
  capacity: number;
  sortOrder: number;
  isActive: boolean;
}

export interface Customer extends Base {
  name: string;
  phone: string;
  lineId: string;
  allergies: string;
  notes: string;
  isRegular: boolean;
  createdAt?: string;
}

export interface RoomAlloc {
  roomId: string;
  guests: number;
  whole: boolean;
}

export interface NightPrice {
  date: ISODate;
  price: Satang;
}

export interface Booking extends Base {
  code: string;
  customerId: string | null;
  name: string;
  phone: string;
  lineId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  channel: Channel;
  status: BookingStatus;
  rooms: RoomAlloc[];
  nightly: NightPrice[];
  discount: Satang;
  extra: Satang;
  extraNote: string;
  total: Satang;
  /** ยอดมัดจำของการจองนี้ (ตั้งตอนจอง แก้ได้) */
  deposit: Satang;
  /** รุ่นเก่า: มัดจำเป็น % (ใช้เมื่อไม่มี deposit) */
  depositPct?: number;
  depositDueOn: ISODate;
  usesTransport: boolean;
  pickupPoint: string;
  pickupTime: string;
  mealCost: Satang;
  transportCost: Satang;
  allergies: string;
  notes: string;
  rescheduleCount: number;
  cancelledOn: ISODate | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  surveyToken: string;
  createdBy: string;
  createdAt: string;
}

export interface Payment extends Base {
  bookingId: string;
  kind: PaymentKind;
  method: PayMethod;
  amount: Satang;
  paidOn: ISODate;
  slipId: string | null;
  note: string;
  recordedBy: string;
  createdAt: string;
}

export interface Closure extends Base {
  roomId: string | null;
  start: ISODate;
  end: ISODate;
  reason: string;
}

export interface PriceRule extends Base {
  name: string;
  start: ISODate;
  end: ISODate;
  pricePerPerson: Satang | null;
  minGuests: number | null;
  discountPct: number | null;
  isActive: boolean;
}

export interface Issue extends Base {
  occurredOn: ISODate;
  title: string;
  detail: string;
  categoryId: string;
  amount: Satang;
  paidOn: ISODate | null;
  status: IssueStatus;
  bookingId: string | null;
  roomId: string | null;
  photoIds: string[];
  reportedBy: string;
  recover: Satang;
  recoverOn: ISODate | null;
  createdAt: string;
}

export interface ExpenseCategory extends Base {
  name: string;
  sortOrder: number;
}

export interface FixedCost extends Base {
  name: string;
  amount: Satang;
  effectiveFrom: string; // YYYY-MM
  effectiveTo: string | null; // YYYY-MM inclusive
}

export interface BookingRequest extends Base {
  name: string;
  phone: string;
  lineId: string;
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  message: string;
  status: 'new' | 'accepted' | 'declined';
  bookingId: string | null;
  createdAt: string;
}

export interface Survey extends Base {
  bookingId: string;
  score: number;
  tags: string[];
  comment: string;
  submittedAt: string;
}

export interface AuditEntry extends Base {
  tableName: string;
  rowId: string;
  action: string;
  summary: string;
  actor: string;
  device: string;
  at: string;
}

export interface UserInfo {
  id: string;
  username: string;
  displayName: string;
  role: 'owner' | 'staff';
}

/** ข้อมูลทั้งหมดที่แอปถือไว้ในเครื่อง */
export interface Dataset {
  settings: Settings;
  rooms: Room[];
  customers: Customer[];
  bookings: Booking[];
  payments: Payment[];
  closures: Closure[];
  priceRules: PriceRule[];
  issues: Issue[];
  categories: ExpenseCategory[];
  fixedCosts: FixedCost[];
  requests: BookingRequest[];
  surveys: Survey[];
  audit: AuditEntry[];
}

export type TableName =
  | 'rooms'
  | 'customers'
  | 'bookings'
  | 'payments'
  | 'closures'
  | 'priceRules'
  | 'issues'
  | 'categories'
  | 'fixedCosts'
  | 'requests'
  | 'surveys';

export const ACTIVE_STATUSES: BookingStatus[] = ['pending', 'confirmed', 'checked_in', 'checked_out'];
export const isActiveBooking = (b: Pick<Booking, 'status' | 'deletedAt'>): boolean => !b.deletedAt && ACTIVE_STATUSES.includes(b.status);
