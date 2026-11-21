/** ค่าตั้งต้นของกิจการ (SRS 5.1) — แก้ได้ทั้งหมดในหน้าตั้งค่า */
import type { Channel, ExpenseCategory, IssueStatus, PayMethod, PayStatus, PaymentKind, Room, Settings, BookingStatus } from './types';

export const DEFAULT_SETTINGS: Settings = {
  pricePerPerson: 85000,
  depositPct: 50,
  depositDueDays: 3,
  mealCost: 6000,
  housekeepingCost: 30000,
  transportCost: 20000,
  checkInTime: '14:00',
  checkOutTime: '11:00',
  promptpayId: '',
  promptpayName: '',
  bankAccount: '',
  bookingMode: 'both',
  rescheduleLimit: 1,
  cancelForfeitsDeposit: true,
  transportTimes: ['10:00', '12:00', '13:00', '15:00'],
  notifyMorningHour: 9,
  notifyEveningHour: 18,
  lineDigest: true,
  publicBooking: true,
  homestay: {
    name: 'คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์',
    shortName: 'คะนึงถึง',
    address: 'ห้วยกุ๊บกั๊บ อ.แม่แตง จ.เชียงใหม่',
    phone: '',
    lineId: '',
    facebook: 'คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์',
    instagram: 'kanuengthueng',
    tagline: 'โฮมสเตย์เล็ก ๆ สำหรับคนที่อยากหนีความวุ่นวายมาพักผ่อน',
  },
};

export const DEFAULT_ROOMS: Room[] = [
  { id: 'room-1', name: 'ห้อง 1', kind: 'small', capacity: 4, sortOrder: 1, isActive: true },
  { id: 'room-2', name: 'ห้อง 2', kind: 'small', capacity: 4, sortOrder: 2, isActive: true },
  { id: 'room-3', name: 'ห้อง 3', kind: 'small', capacity: 4, sortOrder: 3, isActive: true },
  { id: 'room-4', name: 'ห้อง 4', kind: 'small', capacity: 4, sortOrder: 4, isActive: true },
  { id: 'room-5', name: 'ห้อง 5', kind: 'large', capacity: 8, sortOrder: 5, isActive: true },
];

export const DEFAULT_CATEGORIES: ExpenseCategory[] = [
  { id: 'cat-repair', name: 'ซ่อมแซม', sortOrder: 1 },
  { id: 'cat-supplies', name: 'อุปกรณ์ / ของใช้', sortOrder: 2 },
  { id: 'cat-utilities', name: 'ค่าน้ำ–ไฟ', sortOrder: 3 },
  { id: 'cat-cleaning', name: 'ทำความสะอาด', sortOrder: 4 },
  { id: 'cat-compensation', name: 'ชดเชยลูกค้า', sortOrder: 5 },
  { id: 'cat-other', name: 'อื่น ๆ', sortOrder: 6 },
];

export const DEFAULT_FIXED_NAMES = ['ค่าไฟฟ้า', 'ค่าน้ำประปา', 'ค่าอินเทอร์เน็ต'];

export const ROOM_KIND_LABEL: Record<Room['kind'], string> = { small: 'ห้องเล็ก', large: 'ห้องใหญ่' };

export const CHANNEL_LABEL: Record<Channel, string> = {
  facebook: 'Facebook',
  line: 'LINE',
  phone: 'โทร',
  walk_in: 'Walk-in',
  online: 'หน้าจองออนไลน์',
  other: 'อื่น ๆ',
};
export const STAFF_CHANNELS: Channel[] = ['facebook', 'line', 'phone', 'walk_in', 'other'];

export const PAY_STATUS_LABEL: Record<PayStatus, string> = { unpaid: 'ยังไม่ชำระ', deposit: 'มัดจำแล้ว', paid: 'ชำระครบ' };
export const METHOD_LABEL: Record<PayMethod, string> = { transfer: 'โอนธนาคาร', promptpay: 'พร้อมเพย์', cash: 'เงินสด' };
export const PAYMENT_KIND_LABEL: Record<PaymentKind, string> = { deposit: 'มัดจำ', balance: 'ยอดคงเหลือ', refund: 'คืนเงิน', other: 'รับเงิน' };
export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  checked_in: 'กำลังพัก',
  checked_out: 'เช็คเอาท์แล้ว',
  cancelled: 'ยกเลิก',
  no_show: 'ไม่มาเข้าพัก',
};
export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = { open: 'รอแก้ไข', in_progress: 'กำลังแก้', done: 'เสร็จแล้ว' };
export const SURVEY_TAGS = ['ที่พักสะอาด', 'อาหารอร่อย', 'บรรยากาศดี', 'กองไฟ & ดนตรี', 'การบริการ', 'การเดินทาง'];
export const STAR_LABELS = ['', 'ต้องปรับปรุง', 'พอใช้', 'ดี', 'ดีมาก', 'ประทับใจที่สุด'];
