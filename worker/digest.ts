/** ข้อความสรุปรายวัน (ใช้ทั้ง Web Push และ LINE) — SRS ส่วนที่ 9 */
import { addDays, fmtDate, fmtDateLong } from '../src/domain/dates';
import { fmtBaht } from '../src/domain/money';
import { dueOf, guestsOf, paidOf } from '../src/domain/pricing';
import { isActiveBooking, type Dataset } from '../src/domain/types';

export interface DigestLine {
  title: string;
  lines: string[];
}

/** สรุปแขกเข้าพักพรุ่งนี้ (คน/ห้อง/รถ/อาหาร) — 18:00 */
export function tomorrowDigest(ds: Dataset, today: string): DigestLine | null {
  const tm = addDays(today, 1);
  const rooms = new Map(ds.rooms.map((r) => [r.id, r.name]));
  const act = ds.bookings.filter(isActiveBooking);
  const arrive = act.filter((b) => b.checkIn === tm && b.status !== 'pending');
  const leave = act.filter((b) => b.checkOut === tm);
  const staying = act.filter((b) => b.checkIn <= tm && tm < b.checkOut);
  const guests = staying.reduce((s, b) => s + guestsOf(b), 0);
  if (!arrive.length && !leave.length && !guests) return null;
  const lines: string[] = [];
  for (const b of arrive) {
    const due = dueOf(b.total, paidOf(b.id, ds.payments));
    lines.push(`เข้า ${b.name} ${guestsOf(b)} คน · ${b.rooms.map((r) => rooms.get(r.roomId) ?? '').join(', ')}${b.usesTransport ? ` · รถ ${b.pickupTime || ''} ${b.pickupPoint || ''}`.trimEnd() : ''}${due > 0 ? ` · ค้าง ${fmtBaht(due)}` : ''}${b.allergies ? ` · แพ้ ${b.allergies}` : ''}`);
  }
  for (const b of leave) lines.push(`ออก ${b.name} (เช็คเอาท์ 11:00)`);
  const car = arrive.filter((b) => b.usesTransport).reduce((s, b) => s + guestsOf(b), 0);
  lines.push(`คืนพรุ่งนี้มีแขก ${guests} คน · เตรียมอาหาร ${guests} ที่${car ? ` · รถรับส่ง ${car} คน` : ''}`);
  return { title: `พรุ่งนี้ ${fmtDateLong(tm)}`, lines };
}

/** มัดจำใกล้ครบกำหนด/เลยกำหนด และยอดที่ต้องเก็บวันนี้ — 09:00 */
export function morningDigest(ds: Dataset, today: string): DigestLine | null {
  const lines: string[] = [];
  const act = ds.bookings.filter((b) => isActiveBooking(b) && b.status !== 'checked_out');
  for (const b of act) {
    const paid = paidOf(b.id, ds.payments);
    const due = dueOf(b.total, paid);
    if (due <= 0) continue;
    if (b.checkIn === today) lines.push(`เก็บวันนี้ ${b.name} ${fmtBaht(due)}`);
    else if (paid <= 0 && b.depositDueOn < today && b.checkIn > today) lines.push(`มัดจำเลยกำหนด ${b.name} (ครบ ${fmtDate(b.depositDueOn)}) ${fmtBaht(due)}`);
    else if (paid <= 0 && b.depositDueOn <= addDays(today, 1) && b.checkIn > today) lines.push(`มัดจำครบกำหนด${b.depositDueOn === today ? 'วันนี้' : 'พรุ่งนี้'} ${b.name}`);
  }
  if (!lines.length) return null;
  return { title: 'ยอดเงินที่ต้องติดตามวันนี้', lines };
}

export const digestText = (d: DigestLine) => `${d.title}\n${d.lines.map((l) => `• ${l}`).join('\n')}`;
