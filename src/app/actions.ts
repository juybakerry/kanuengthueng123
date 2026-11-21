/** การทำรายการที่ใช้หลายหน้าจอ: เช็คอิน/เอาท์ ยกเลิก รับเงิน */
import { save, newId, getState } from '../lib/store';
import { confirmDialog, toast } from './ui';
import { viewOf } from './derive';
import { todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { METHOD_LABEL } from '../domain/defaults';
import type { Booking, PayMethod, Payment, PaymentKind, Satang } from '../domain/types';

export async function checkIn(b: Booking) {
  const v = viewOf(b, getState().ds.payments);
  if (v.due > 0) {
    const ok = await confirmDialog({ title: `เช็คอิน ${b.name}?`, body: `ยังค้างชำระ ${fmtBaht(v.due)} — เก็บเงินได้จากหน้ารายละเอียดการจอง`, yes: 'เช็คอิน' });
    if (!ok) return;
  }
  save('bookings', { ...b, status: 'checked_in', checkedInAt: new Date().toISOString() }, { summary: 'เช็คอิน' });
  toast(`เช็คอิน ${b.name} แล้ว`, { undo: () => save('bookings', { ...b }, { summary: 'เลิกทำเช็คอิน' }) });
}

export async function checkOut(b: Booking) {
  const v = viewOf(b, getState().ds.payments);
  if (v.due > 0) {
    const ok = await confirmDialog({ title: 'ยังค้างชำระอยู่', body: `${b.name} ยังค้าง ${fmtBaht(v.due)} ต้องการเช็คเอาท์เลยหรือไม่`, yes: 'เช็คเอาท์', no: 'กลับไปเก็บเงิน' });
    if (!ok) return;
  }
  save('bookings', { ...b, status: 'checked_out', checkedOutAt: new Date().toISOString() }, { summary: 'เช็คเอาท์' });
  toast(`เช็คเอาท์ ${b.name} แล้ว`, { undo: () => save('bookings', { ...b }, { summary: 'เลิกทำเช็คเอาท์' }) });
}

export async function cancelBooking(b: Booking): Promise<boolean> {
  const st = getState().ds.settings;
  const v = viewOf(b, getState().ds.payments);
  const ok = await confirmDialog({
    title: 'ยกเลิกการจองนี้?',
    body: `${b.name} · ${st.cancelForfeitsDeposit ? `ตามนโยบายจะไม่คืนมัดจำ${v.paid > 0 ? ` (รับแล้ว ${fmtBaht(v.paid)} จะนับเป็นรายรับของวันนี้)` : ''}` : 'ระบบจะไม่คืนเงินให้อัตโนมัติ'} หากลูกค้าต้องการเลื่อนวัน ให้ใช้ "เลื่อนวัน" แทน`,
    yes: 'ยกเลิกการจอง',
    no: 'ไม่ยกเลิก',
    danger: true,
  });
  if (!ok) return false;
  save('bookings', { ...b, status: 'cancelled', cancelledOn: todayISO() }, { summary: 'ยกเลิกการจอง' });
  toast('ยกเลิกการจองแล้ว', { undo: () => save('bookings', { ...b }, { summary: 'เลิกทำการยกเลิก' }) });
  return true;
}

export function recordPayment(b: Booking, kind: PaymentKind, amount: Satang, method: PayMethod, slipId: string | null, paidOn = todayISO(), note = '') {
  const p: Payment = { id: newId(), bookingId: b.id, kind, method, amount, paidOn, slipId, note, recordedBy: getState().user?.displayName ?? '', createdAt: new Date().toISOString() };
  save('payments', p);
  toast(`${kind === 'refund' ? 'คืนเงิน' : 'รับเงิน'} ${fmtBaht(amount)} (${METHOD_LABEL[method]}) แล้ว`);
  return p;
}
