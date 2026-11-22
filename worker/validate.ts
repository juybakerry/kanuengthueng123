/** ตรวจและทำความสะอาดข้อมูลที่ส่งมาจากแอปก่อนเขียนลงฐานข้อมูล (ฝั่งเซิร์ฟเวอร์ ไม่เชื่อข้อมูลจากเครื่อง) */
import { HttpError } from './http';
import { DEFAULT_SETTINGS } from '../src/domain/defaults';
import { bookingDeposit } from '../src/domain/pricing';
import type { Settings } from '../src/domain/types';

type Obj = Record<string, unknown>;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YM_RE = /^\d{4}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const bad = (field: string): never => {
  throw new HttpError(400, `ข้อมูล "${field}" ไม่ถูกต้อง`, 'VALIDATION');
};

const str = (v: unknown, max = 200): string => (v == null ? '' : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max).trim());
const int = (v: unknown, field: string, min = 0, max = 1e12): number => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < min || n > max) bad(field);
  return n;
};
const num = (v: unknown, field: string, min = 0, max = 1e6): number => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n) || n < min || n > max) bad(field);
  return n;
};
const bool = (v: unknown) => v === true || v === 1 || v === 'true';
const date = (v: unknown, field: string): string => {
  const s = String(v ?? '');
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) bad(field);
  return s;
};
const dateOrNull = (v: unknown, field: string) => (v == null || v === '' ? null : date(v, field));
const oneOf = <T extends string>(v: unknown, list: readonly T[], field: string): T => (list.includes(v as T) ? (v as T) : bad(field));
const idOrNull = (v: unknown) => (v == null || v === '' ? null : str(v, 64));
const time = (v: unknown) => (TIME_RE.test(String(v ?? '')) ? String(v) : '');

export const CLIENT_TABLES = ['settings', 'rooms', 'customers', 'bookings', 'payments', 'closures', 'priceRules', 'issues', 'categories', 'fixedCosts', 'requests', 'surveys'] as const;
export type ClientTable = (typeof CLIENT_TABLES)[number];

export function sanitize(tbl: ClientTable, d: Obj): Obj {
  switch (tbl) {
    case 'settings':
      return sanitizeSettings(d) as unknown as Obj;
    case 'rooms':
      return { name: str(d.name, 40) || bad('ชื่อห้อง'), kind: oneOf(d.kind, ['small', 'large'], 'ประเภทห้อง'), capacity: int(d.capacity, 'ความจุ', 1, 50), sortOrder: int(d.sortOrder, 'ลำดับ', 0, 999), isActive: bool(d.isActive) };
    case 'customers':
      return { name: str(d.name, 120) || bad('ชื่อลูกค้า'), phone: str(d.phone, 40), lineId: str(d.lineId, 60), allergies: str(d.allergies, 300), notes: str(d.notes, 1000), isRegular: bool(d.isRegular), createdAt: str(d.createdAt, 40) };
    case 'bookings':
      return sanitizeBooking(d);
    case 'payments':
      return {
        bookingId: str(d.bookingId, 64) || bad('การจอง'),
        kind: oneOf(d.kind, ['deposit', 'balance', 'refund', 'other'], 'ประเภทการรับเงิน'),
        method: oneOf(d.method, ['transfer', 'promptpay', 'cash'], 'ช่องทางชำระ'),
        amount: int(d.amount, 'จำนวนเงิน', 1, 1e10),
        paidOn: date(d.paidOn, 'วันที่ชำระ'),
        slipId: idOrNull(d.slipId),
        note: str(d.note, 300),
        recordedBy: str(d.recordedBy, 60),
        createdAt: str(d.createdAt, 40),
      };
    case 'closures': {
      const start = date(d.start, 'วันเริ่ม');
      const end = date(d.end, 'วันสิ้นสุด');
      if (end < start) bad('ช่วงวันที่');
      return { roomId: idOrNull(d.roomId), start, end, reason: str(d.reason, 200) };
    }
    case 'priceRules': {
      const start = date(d.start, 'วันเริ่ม');
      const end = date(d.end, 'วันสิ้นสุด');
      if (end < start) bad('ช่วงวันที่');
      const price = d.pricePerPerson == null || d.pricePerPerson === '' ? null : int(d.pricePerPerson, 'ราคาต่อคน', 0, 1e9);
      const disc = d.discountPct == null || d.discountPct === '' ? null : num(d.discountPct, 'ส่วนลด %', 0, 100);
      return { name: str(d.name, 80) || bad('ชื่อราคาพิเศษ'), start, end, pricePerPerson: price, minGuests: d.minGuests == null || d.minGuests === '' ? null : int(d.minGuests, 'จำนวนคนขั้นต่ำ', 1, 999), discountPct: disc, isActive: bool(d.isActive) };
    }
    case 'issues':
      return {
        occurredOn: date(d.occurredOn, 'วันที่เกิดปัญหา'),
        title: str(d.title, 200) || bad('หัวข้อ'),
        detail: str(d.detail, 2000),
        categoryId: str(d.categoryId, 64),
        amount: int(d.amount, 'จำนวนเงิน', 0, 1e10),
        paidOn: dateOrNull(d.paidOn, 'วันที่จ่าย'),
        status: oneOf(d.status, ['open', 'in_progress', 'done'], 'สถานะ'),
        bookingId: idOrNull(d.bookingId),
        roomId: idOrNull(d.roomId),
        photoIds: Array.isArray(d.photoIds) ? d.photoIds.slice(0, 10).map((x) => str(x, 64)) : [],
        reportedBy: str(d.reportedBy, 60),
        recover: int(d.recover, 'เงินเรียกคืน', 0, 1e10),
        recoverOn: dateOrNull(d.recoverOn, 'วันที่เรียกคืน'),
        createdAt: str(d.createdAt, 40),
      };
    case 'categories':
      return { name: str(d.name, 60) || bad('ชื่อหมวด'), sortOrder: int(d.sortOrder, 'ลำดับ', 0, 999) };
    case 'fixedCosts': {
      const from = String(d.effectiveFrom ?? '');
      const to = d.effectiveTo == null || d.effectiveTo === '' ? null : String(d.effectiveTo);
      if (!YM_RE.test(from) || (to && !YM_RE.test(to))) bad('เดือนที่มีผล');
      return { name: str(d.name, 60) || bad('ชื่อรายการ'), amount: int(d.amount, 'จำนวนเงิน', 0, 1e10), effectiveFrom: from, effectiveTo: to };
    }
    case 'requests':
      return {
        name: str(d.name, 120),
        phone: str(d.phone, 40),
        lineId: str(d.lineId, 60),
        checkIn: date(d.checkIn, 'วันเข้าพัก'),
        checkOut: date(d.checkOut, 'วันออก'),
        adults: int(d.adults, 'ผู้ใหญ่', 0, 99),
        children: int(d.children, 'เด็ก', 0, 99),
        message: str(d.message, 1000),
        status: oneOf(d.status, ['new', 'accepted', 'declined'], 'สถานะคำขอ'),
        bookingId: idOrNull(d.bookingId),
        createdAt: str(d.createdAt, 40),
      };
    case 'surveys':
      return { bookingId: str(d.bookingId, 64), score: int(d.score, 'คะแนน', 1, 5), tags: Array.isArray(d.tags) ? d.tags.slice(0, 10).map((x) => str(x, 40)) : [], comment: str(d.comment, 2000), submittedAt: str(d.submittedAt, 40) };
  }
}

function sanitizeBooking(d: Obj): Obj {
  const b = sanitizeBookingRaw(d);
  b.deposit = Math.min(b.deposit as number, b.total as number);
  return b;
}

function sanitizeBookingRaw(d: Obj): Obj {
  const checkIn = date(d.checkIn, 'วันเข้าพัก');
  const checkOut = date(d.checkOut, 'วันออก');
  if (checkOut <= checkIn) bad('วันออกต้องหลังวันเข้าพัก');
  if ((Date.parse(checkOut) - Date.parse(checkIn)) / 86400000 > 60) bad('จำนวนคืน (สูงสุด 60 คืน)');
  const adults = int(d.adults, 'ผู้ใหญ่', 0, 200);
  const children = int(d.children, 'เด็ก', 0, 200);
  if (adults + children < 1) bad('จำนวนผู้เข้าพัก');
  const rooms = (Array.isArray(d.rooms) ? d.rooms : []).slice(0, 20).map((r: Obj) => ({ roomId: str(r.roomId, 64), guests: int(r.guests, 'จำนวนคนในห้อง', 0, 200), whole: bool(r.whole) }));
  const nightly = (Array.isArray(d.nightly) ? d.nightly : []).slice(0, 61).map((n: Obj) => ({ date: date(n.date, 'ราคารายคืน'), price: int(n.price, 'ราคารายคืน', 0, 1e9) }));
  return {
    code: str(d.code, 30),
    customerId: idOrNull(d.customerId),
    name: str(d.name, 120) || bad('ชื่อลูกค้า'),
    phone: str(d.phone, 40),
    lineId: str(d.lineId, 60),
    checkIn,
    checkOut,
    adults,
    children,
    channel: oneOf(d.channel, ['facebook', 'line', 'phone', 'walk_in', 'online', 'other'], 'ช่องทางจอง'),
    status: oneOf(d.status, ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'], 'สถานะ'),
    rooms,
    nightly,
    discount: int(d.discount, 'ส่วนลด', 0, 1e10),
    extra: int(d.extra, 'รายการเพิ่ม', 0, 1e10),
    extraNote: str(d.extraNote, 200),
    total: int(d.total, 'ยอดรวม', 0, 1e11),
    deposit: d.deposit == null || d.deposit === '' ? bookingDeposit({ total: Number(d.total) || 0, depositPct: Number(d.depositPct ?? 50) } as never) : int(d.deposit, 'ยอดมัดจำ', 0, 1e11),
    depositDueOn: date(d.depositDueOn, 'กำหนดชำระมัดจำ'),
    usesTransport: bool(d.usesTransport),
    pickupPoint: str(d.pickupPoint, 200),
    pickupTime: time(d.pickupTime),
    mealCost: int(d.mealCost, 'ค่าอาหาร', 0, 1e8),
    transportCost: int(d.transportCost, 'ค่ารถ', 0, 1e8),
    allergies: str(d.allergies, 500),
    notes: str(d.notes, 2000),
    rescheduleCount: int(d.rescheduleCount, 'จำนวนครั้งที่เลื่อน', 0, 99),
    cancelledOn: dateOrNull(d.cancelledOn, 'วันที่ยกเลิก'),
    checkedInAt: d.checkedInAt ? str(d.checkedInAt, 40) : null,
    checkedOutAt: d.checkedOutAt ? str(d.checkedOutAt, 40) : null,
    surveyToken: str(d.surveyToken, 40),
    createdBy: str(d.createdBy, 60),
    createdAt: str(d.createdAt, 40),
  };
}

function sanitizeSettings(d: Obj): Settings {
  const D = DEFAULT_SETTINGS;
  const h = (d.homestay ?? {}) as Obj;
  const hour = (v: unknown, def: number) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 23 ? n : def;
  };
  return {
    pricePerPerson: int(d.pricePerPerson ?? D.pricePerPerson, 'ราคาต่อคน', 0, 1e9),
    depositMode: oneOf(d.depositMode ?? D.depositMode, ['percent', 'booking', 'person'], 'วิธีคิดมัดจำ'),
    depositPct: num(d.depositPct ?? D.depositPct, 'มัดจำ %', 0, 100),
    depositAmount: int(d.depositAmount ?? D.depositAmount, 'ยอดมัดจำ', 0, 1e9),
    depositDueDays: int(d.depositDueDays ?? D.depositDueDays, 'กำหนดชำระมัดจำ', 0, 60),
    mealCost: int(d.mealCost ?? D.mealCost, 'ค่าอาหาร', 0, 1e8),
    housekeepingCost: int(d.housekeepingCost ?? D.housekeepingCost, 'ค่าแม่บ้าน', 0, 1e8),
    transportCost: int(d.transportCost ?? D.transportCost, 'ค่ารถ', 0, 1e8),
    checkInTime: time(d.checkInTime) || D.checkInTime,
    checkOutTime: time(d.checkOutTime) || D.checkOutTime,
    promptpayId: str(d.promptpayId, 20).replace(/[^\d]/g, ''),
    promptpayName: str(d.promptpayName, 80),
    bankAccount: str(d.bankAccount, 120),
    bookingMode: oneOf(d.bookingMode ?? D.bookingMode, ['both', 'room', 'person'], 'รูปแบบการจอง'),
    rescheduleLimit: int(d.rescheduleLimit ?? D.rescheduleLimit, 'เลื่อนได้กี่ครั้ง', 0, 10),
    cancelForfeitsDeposit: d.cancelForfeitsDeposit == null ? D.cancelForfeitsDeposit : bool(d.cancelForfeitsDeposit),
    transportTimes: (Array.isArray(d.transportTimes) ? d.transportTimes : D.transportTimes).map(time).filter(Boolean).slice(0, 8),
    notifyMorningHour: hour(d.notifyMorningHour, D.notifyMorningHour),
    notifyEveningHour: hour(d.notifyEveningHour, D.notifyEveningHour),
    lineDigest: d.lineDigest == null ? D.lineDigest : bool(d.lineDigest),
    publicBooking: d.publicBooking == null ? D.publicBooking : bool(d.publicBooking),
    homestay: {
      name: str(h.name, 120) || D.homestay.name,
      shortName: str(h.shortName, 40) || D.homestay.shortName,
      address: str(h.address, 300),
      phone: str(h.phone, 40),
      lineId: str(h.lineId, 60),
      facebook: str(h.facebook, 200),
      instagram: str(h.instagram, 100),
      tagline: str(h.tagline, 200),
    },
  };
}
