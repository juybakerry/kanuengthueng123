/**
 * ราคาและยอดเงินของการจอง (SRS 5.2)
 * รายรับการจอง = Σ ทุกคืน (ราคาต่อคนของคืนนั้น × จำนวนแขก) − ส่วนลด + รายการเพิ่ม
 * ยอดมัดจำ = ปัดขึ้นเป็นบาทเต็ม(ยอดรวม × มัดจำ%)
 */
import { addDays, nightsOf } from './dates';
import { ceilBaht } from './money';
import type { Booking, ISODate, NightPrice, PayStatus, Payment, PriceRule, Satang, Settings } from './types';

export const guestsOf = (b: Pick<Booking, 'adults' | 'children'>) => b.adults + b.children;

/** กฎราคาที่มีผลกับคืนนั้น (ช่วงวันที่รวมวันสุดท้าย) */
function rulesFor(date: ISODate, guests: number, rules: PriceRule[]): PriceRule[] {
  return rules.filter((r) => r.isActive && !r.deletedAt && r.start <= date && date <= r.end && (r.minGuests == null || guests >= r.minGuests));
}

/**
 * ราคาต่อคนของคืนหนึ่ง
 * - ถ้ามีกฎที่กำหนด "ราคาต่อคน" หลายกฎซ้อนกัน ใช้กฎที่ช่วงวันสั้นที่สุด (เจาะจงที่สุด) · เท่ากันใช้กฎที่เริ่มทีหลัง
 * - ส่วนลด % ไม่ทบกัน ใช้ส่วนลดที่มากที่สุดที่เข้าเงื่อนไข แล้วปัดลงเป็นบาทเต็ม
 */
export function pricePerPersonFor(date: ISODate, guests: number, settings: Pick<Settings, 'pricePerPerson'>, rules: PriceRule[]): Satang {
  const matched = rulesFor(date, guests, rules);
  const priced = matched
    .filter((r) => r.pricePerPerson != null)
    .sort((a, b) => spanDays(a) - spanDays(b) || b.start.localeCompare(a.start));
  let price = priced[0]?.pricePerPerson ?? settings.pricePerPerson;
  const pct = Math.max(0, ...matched.map((r) => r.discountPct ?? 0));
  if (pct > 0) price = Math.floor((price * (100 - Math.min(pct, 100))) / 100 / 100) * 100;
  return price;
}

function spanDays(r: PriceRule): number {
  return (Date.parse(r.end) - Date.parse(r.start)) / 86400000;
}

export interface QuoteInput {
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  discount?: Satang;
  extra?: Satang;
  bookedOn: ISODate;
}

export interface Quote {
  nights: number;
  guests: number;
  nightly: NightPrice[];
  subtotal: Satang;
  total: Satang;
  deposit: Satang;
  depositDueOn: ISODate;
}

export function quote(input: QuoteInput, settings: Settings, rules: PriceRule[]): Quote {
  const guests = input.adults + input.children;
  const nightly = nightsOf(input.checkIn, input.checkOut).map((date) => ({ date, price: pricePerPersonFor(date, guests, settings, rules) }));
  const subtotal = nightly.reduce((s, n) => s + n.price * guests, 0);
  const total = Math.max(0, subtotal - (input.discount ?? 0) + (input.extra ?? 0));
  return {
    nights: nightly.length,
    guests,
    nightly,
    subtotal,
    total,
    deposit: depositOf(total, settings.depositPct),
    depositDueOn: addDays(input.bookedOn, settings.depositDueDays),
  };
}

/** ยอดรวมจากราคารายคืนที่บันทึกไว้ในการจอง (ราคา ณ วันจอง) */
export function totalFromNightly(nightly: NightPrice[], guests: number, discount: Satang, extra: Satang): Satang {
  return Math.max(0, nightly.reduce((s, n) => s + n.price * guests, 0) - discount + extra);
}

export function depositOf(total: Satang, pct: number): Satang {
  return ceilBaht((total * pct) / 100);
}

/** ยอดรับสุทธิ (รับ − คืน) ของการจอง */
export function paidOf(bookingId: string, payments: Payment[]): Satang {
  let s = 0;
  for (const p of payments) {
    if (p.bookingId !== bookingId || p.deletedAt) continue;
    s += p.kind === 'refund' ? -p.amount : p.amount;
  }
  return s;
}

/** สถานะชำระ: 0 → ยังไม่ชำระ · 0 < รับ < รวม → มัดจำ · รับ ≥ รวม → ชำระครบ */
export function payStatusOf(total: Satang, paid: Satang): PayStatus {
  if (paid <= 0) return total <= 0 ? 'paid' : 'unpaid';
  return paid >= total ? 'paid' : 'deposit';
}

export const dueOf = (total: Satang, paid: Satang): Satang => Math.max(0, total - paid);
