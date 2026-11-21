/** วันที่และรูปแบบไทย: วันที่เก็บเป็น 'YYYY-MM-DD' (เวลาไทย) แสดงผลเป็น พ.ศ. */
import type { ISODate } from './types';

export const TZ = 'Asia/Bangkok';

const pad = (n: number) => String(n).padStart(2, '0');

/** วันที่ปัจจุบันตามเวลาไทย */
export function todayISO(now: Date = new Date()): ISODate {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return s; // en-CA → YYYY-MM-DD
}

/** ชั่วโมงปัจจุบันตามเวลาไทย (0–23) */
export function bangkokHour(now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now)) % 24;
}

export function parseISO(d: ISODate): Date {
  const [y, m, dd] = d.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd!));
}

export function toISO(d: Date): ISODate {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(d: ISODate, n: number): ISODate {
  const x = parseISO(d);
  x.setUTCDate(x.getUTCDate() + n);
  return toISO(x);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** คืนที่พัก: check_in ถึงวันก่อน check_out (check_out ไม่นับเป็นคืน) */
export function nightsOf(checkIn: ISODate, checkOut: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) out.push(d);
  return out;
}

/** ทุกวันในช่วง (รวมวันสุดท้าย) */
export function daysInclusive(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthKey(d: ISODate): string {
  return d.slice(0, 7);
}

export function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y!, m!, 0)).getUTCDate();
}

export function startOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-01`;
}

export function endOfMonth(d: ISODate): ISODate {
  return `${d.slice(0, 7)}-${pad(daysInMonth(d.slice(0, 7)))}`;
}

export function addMonths(d: ISODate, n: number): ISODate {
  const x = parseISO(startOfMonth(d));
  x.setUTCMonth(x.getUTCMonth() + n);
  return toISO(x);
}

/** 0 = อาทิตย์ */
export function dayOfWeek(d: ISODate): number {
  return parseISO(d).getUTCDay();
}

export const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const TH_DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export const beYear = (y: number) => y + 543;

/** 21 พ.ย. 2569 */
export function fmtDate(d: ISODate | null | undefined, opts: { year?: boolean } = {}): string {
  if (!d) return '–';
  const [y, m, dd] = d.split('-').map(Number);
  return `${dd} ${TH_MONTHS_SHORT[m! - 1]}${opts.year === false ? '' : ` ${beYear(y!)}`}`;
}

/** วันเสาร์ที่ 21 พ.ย. 2569 */
export function fmtDateLong(d: ISODate): string {
  return `วัน${TH_DAYS[dayOfWeek(d)]}ที่ ${fmtDate(d)}`;
}

/** พฤศจิกายน 2569 */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${TH_MONTHS[m! - 1]} ${beYear(y!)}`;
}

/** 21–23 พ.ย. 2569 หรือ 30 พ.ย. – 2 ธ.ค. 2569 */
export function fmtRange(a: ISODate, b: ISODate): string {
  if (a === b) return fmtDate(a);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${Number(a.slice(8))}–${fmtDate(b)}`;
  if (a.slice(0, 4) === b.slice(0, 4)) return `${fmtDate(a, { year: false })} – ${fmtDate(b)}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}

/** เวลาไทยของ timestamp ISO: 21 พ.ย. 2569 · 14:05 */
export function fmtDateTime(ts: string | null | undefined): string {
  if (!ts) return '–';
  const t = new Date(ts);
  const d = todayISO(t);
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
  return `${fmtDate(d)} · ${hm}`;
}
