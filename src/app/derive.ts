/** ค่าที่คำนวณจากข้อมูล (ไม่เก็บซ้ำ) สำหรับหน้าจอ — สูตรเงินทั้งหมดเรียกจาก src/domain */
import { bookingDeposit, dueOf, guestsOf, paidOf, payStatusOf } from '../domain/pricing';
import { nightsOf } from '../domain/dates';
import type { Booking, Dataset, PayStatus, Payment } from '../domain/types';

export type PillKind = PayStatus | 'checkedin' | 'closed' | 'cancelled' | 'pending' | 'out' | 'noshow';

export const PILL: Record<PillKind, { bg: string; fg: string; label: string }> = {
  unpaid: { bg: '#B3412E', fg: '#FFFFFF', label: 'ยังไม่ชำระ' },
  deposit: { bg: '#C98A12', fg: '#1F2320', label: 'มัดจำแล้ว' },
  paid: { bg: '#3F7A4A', fg: '#FFFFFF', label: 'ชำระครบ' },
  checkedin: { bg: '#5F7B7D', fg: '#FFFFFF', label: 'กำลังพัก' },
  closed: { bg: '#8A8F8B', fg: '#1F2320', label: 'ปิดห้อง' },
  cancelled: { bg: '#8A8F8B', fg: '#1F2320', label: 'ยกเลิกแล้ว' },
  noshow: { bg: '#8A8F8B', fg: '#1F2320', label: 'ไม่มาเข้าพัก' },
  pending: { bg: '#E9DDBA', fg: '#1F2320', label: 'รอยืนยัน' },
  out: { bg: '#DDE1DC', fg: '#1F2320', label: 'เช็คเอาท์แล้ว' },
};

export interface BookingView {
  b: Booking;
  guests: number;
  nights: number;
  paid: number;
  due: number;
  deposit: number;
  pay: PayStatus;
  /** ป้ายหลัก: สถานะการพักถ้าพักอยู่/ยกเลิก ไม่งั้นสถานะชำระ */
  pill: PillKind;
  payments: Payment[];
}

export function viewOf(b: Booking, payments: Payment[]): BookingView {
  const paid = paidOf(b.id, payments);
  const pay = payStatusOf(b.total, paid);
  let pill: PillKind = pay;
  if (b.status === 'checked_in') pill = 'checkedin';
  else if (b.status === 'cancelled') pill = 'cancelled';
  else if (b.status === 'no_show') pill = 'noshow';
  else if (b.status === 'pending') pill = 'pending';
  return {
    b,
    guests: guestsOf(b),
    nights: nightsOf(b.checkIn, b.checkOut).length,
    paid,
    due: dueOf(b.total, paid),
    deposit: bookingDeposit(b),
    pay,
    pill,
    payments: payments.filter((p) => p.bookingId === b.id && !p.deletedAt).sort((x, y) => x.paidOn.localeCompare(y.paidOn) || x.createdAt.localeCompare(y.createdAt)),
  };
}

/** สีแถบการจองบนปฏิทิน (สถานะชำระ หรือกำลังพัก) */
export function barColor(v: BookingView): string {
  if (v.b.status === 'checked_in') return PILL.checkedin.bg;
  if (v.b.status === 'pending') return '#A08A4E';
  return PILL[v.pay].bg;
}

/** สีตัวอักษรบนแถบ (มัดจำ = เหลือง ใช้ตัวอักษรสีถ่าน) */
export function barText(v: BookingView): string {
  return v.b.status !== 'checked_in' && v.b.status !== 'pending' && v.pay === 'deposit' ? '#1F2320' : '#FFFFFF';
}

export function roomNames(b: Booking, ds: Pick<Dataset, 'rooms'>): string {
  const m = new Map(ds.rooms.map((r) => [r.id, r.name]));
  return b.rooms.map((r) => m.get(r.roomId) ?? 'ห้องที่ถูกลบ').join(', ');
}

export function initials(name: string): string {
  const t = name.replace(/^(คุณ|นาย|นางสาว|นาง|ครู|พี่|น้อง)\s*/u, '').trim();
  return [...(t || name)][0] ?? '?';
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
