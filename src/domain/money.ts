/** เงิน: เก็บเป็นสตางค์ (integer) แสดงเป็น ฿1,234 */
import type { Satang } from './types';

export const baht = (b: number): Satang => Math.round(b * 100);
export const toBaht = (s: Satang): number => s / 100;

const fmt0 = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });
const fmt2 = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** ฿1,234 (แสดงสตางค์เมื่อมีเศษ) */
export function fmtBaht(s: Satang | null | undefined): string {
  const v = s ?? 0;
  const neg = v < 0;
  const abs = Math.abs(v);
  const txt = abs % 100 === 0 ? fmt0.format(abs / 100) : fmt2.format(abs / 100);
  return `${neg ? '−' : ''}฿${txt}`;
}

/** 1,234 ไม่มีสัญลักษณ์ */
export function fmtNum(n: number): string {
  return fmt0.format(n);
}

/** แปลงข้อความที่ผู้ใช้พิมพ์ (บาท) เป็นสตางค์ · ค่าที่อ่านไม่ได้ → null */
export function parseBaht(input: string | number | null | undefined): Satang | null {
  if (input == null) return null;
  const t = String(input).replace(/[฿,\s]/g, '');
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

/** ปัดขึ้นเป็นจำนวนเต็มบาท */
export function ceilBaht(s: Satang): Satang {
  return Math.ceil(s / 100) * 100;
}
