import { describe, expect, it } from 'vitest';
import { report, bookingCosts } from '../src/domain/costs';
import { checkBooking, dayFree, autoAllocate } from '../src/domain/capacity';
import { bookingDeposit, depositFor, depositOf, payStatusOf, pricePerPersonFor, quote } from '../src/domain/pricing';
import { addDays, fmtDate, fmtRange, nightsOf, todayISO } from '../src/domain/dates';
import { fmtBaht, parseBaht } from '../src/domain/money';
import { DEFAULT_ROOMS, DEFAULT_SETTINGS } from '../src/domain/defaults';
import { promptpayPayload } from '../src/domain/promptpay';
import type { Booking, PriceRule } from '../src/domain/types';

const S = DEFAULT_SETTINGS;

function mkBooking(over: Partial<Booking> & { checkIn: string; checkOut: string; adults: number }): Booking {
  const q = quote({ checkIn: over.checkIn, checkOut: over.checkOut, adults: over.adults, children: over.children ?? 0, bookedOn: '2026-11-01' }, S, []);
  return {
    id: over.id ?? 'b1',
    code: 'KT-2569-0001',
    customerId: null,
    name: 'ทดสอบ',
    phone: '',
    lineId: '',
    children: 0,
    channel: 'phone',
    status: 'confirmed',
    rooms: [{ roomId: 'room-5', guests: over.adults, whole: false }],
    nightly: q.nightly,
    discount: 0,
    extra: 0,
    extraNote: '',
    total: q.total,
    deposit: q.deposit,
    depositDueOn: q.depositDueOn,
    usesTransport: true,
    pickupPoint: '',
    pickupTime: '',
    mealCost: S.mealCost,
    transportCost: S.transportCost,
    allergies: '',
    notes: '',
    rescheduleCount: 0,
    cancelledOn: null,
    checkedInAt: null,
    checkedOutAt: null,
    surveyToken: 't',
    createdBy: 'u',
    createdAt: '',
    ...over,
  } as Booking;
}

function pl(b: Booking) {
  const r = report(b.checkIn, addDays(b.checkOut, -1), { rooms: DEFAULT_ROOMS, bookings: [b], payments: [], issues: [], fixedCosts: [], housekeepingCost: S.housekeepingCost });
  return { revenue: r.revenue / 100, meal: r.meal / 100, maid: r.housekeeping / 100, car: r.transport / 100, cost: r.costTotal / 100, profit: r.profit / 100 };
}

describe('SRS 5.3 กรณีทดสอบบังคับ', () => {
  it('10 คน 1 คืน (ใช้รถ)', () => {
    expect(pl(mkBooking({ checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 10, rooms: [{ roomId: 'room-5', guests: 8, whole: false }, { roomId: 'room-1', guests: 2, whole: false }] }))).toEqual({ revenue: 8500, meal: 600, maid: 300, car: 2000, cost: 2900, profit: 5600 });
  });
  it('24 คน 1 คืน (ใช้รถ)', () => {
    expect(pl(mkBooking({ checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 24 }))).toEqual({ revenue: 20400, meal: 1440, maid: 300, car: 4800, cost: 6540, profit: 13860 });
  });
  it('10 คน 2 คืน (ใช้รถ)', () => {
    expect(pl(mkBooking({ checkIn: '2026-12-05', checkOut: '2026-12-07', adults: 10 }))).toEqual({ revenue: 17000, meal: 1200, maid: 600, car: 2000, cost: 3800, profit: 13200 });
  });
  it('bookingCosts ให้ผลเดียวกัน', () => {
    const c = bookingCosts(mkBooking({ checkIn: '2026-12-05', checkOut: '2026-12-07', adults: 10 }), S.housekeepingCost);
    expect(c.profit / 100).toBe(13200);
  });
});

describe('ค่าแม่บ้านคิดรวมระดับวัน', () => {
  it('2 การจองในคืนเดียวกัน = 300 บาท', () => {
    const a = mkBooking({ id: 'a', checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 4, usesTransport: false, rooms: [{ roomId: 'room-1', guests: 4, whole: false }] });
    const b = mkBooking({ id: 'b', checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 4, usesTransport: false, rooms: [{ roomId: 'room-2', guests: 4, whole: false }] });
    const r = report('2026-12-01', '2026-12-31', { rooms: DEFAULT_ROOMS, bookings: [a, b], payments: [], issues: [], fixedCosts: [], housekeepingCost: S.housekeepingCost });
    expect(r.housekeeping).toBe(30000);
    expect(r.revenue).toBe(680000);
  });
  it('ต้นทุนคงที่เต็มเดือน และยกเลิกนับมัดจำเป็นรายรับวันที่ยกเลิก', () => {
    const c = mkBooking({ id: 'c', checkIn: '2026-12-20', checkOut: '2026-12-21', adults: 2, status: 'cancelled', cancelledOn: '2026-12-10' });
    const r = report('2026-12-01', '2026-12-31', {
      rooms: DEFAULT_ROOMS,
      bookings: [c],
      payments: [{ id: 'p', bookingId: 'c', kind: 'deposit', method: 'cash', amount: 85000, paidOn: '2026-12-02', slipId: null, note: '', recordedBy: '', createdAt: '' }],
      issues: [{ id: 'i', occurredOn: '2026-12-03', title: 'x', detail: '', categoryId: '', amount: 50000, paidOn: '2026-12-04', status: 'done', bookingId: null, roomId: null, photoIds: [], reportedBy: '', recover: 20000, recoverOn: null, createdAt: '' }],
      fixedCosts: [{ id: 'f', name: 'ค่าไฟ', amount: 310000, effectiveFrom: '2026-01', effectiveTo: null }],
      housekeepingCost: S.housekeepingCost,
    });
    expect(r.forfeits).toBe(85000);
    expect(r.recovered).toBe(20000);
    expect(r.issueCost).toBe(50000);
    expect(r.fixed).toBe(310000);
    expect(r.meal).toBe(0);
    expect(r.profit).toBe(85000 + 20000 - 50000 - 310000);
  });
});

describe('ราคาพิเศษและมัดจำ', () => {
  const rules: PriceRule[] = [
    { id: 'r1', name: 'ปีใหม่', start: '2026-12-28', end: '2027-01-03', pricePerPerson: 120000, minGuests: null, discountPct: null, isActive: true },
    { id: 'r2', name: 'คืนข้ามปี', start: '2026-12-31', end: '2026-12-31', pricePerPerson: 150000, minGuests: null, discountPct: null, isActive: true },
    { id: 'r3', name: 'กลุ่มใหญ่', start: '2026-01-01', end: '2027-12-31', pricePerPerson: null, minGuests: 15, discountPct: 10, isActive: true },
    { id: 'r4', name: 'ปิดอยู่', start: '2026-01-01', end: '2027-12-31', pricePerPerson: 1, minGuests: null, discountPct: null, isActive: false },
  ];
  it('ราคาปกติ', () => expect(pricePerPersonFor('2026-12-10', 4, S, rules)).toBe(85000));
  it('ช่วงเทศกาล', () => expect(pricePerPersonFor('2026-12-29', 4, S, rules)).toBe(120000));
  it('กฎซ้อนช่วง ใช้กฎที่เจาะจงกว่า', () => expect(pricePerPersonFor('2026-12-31', 4, S, rules)).toBe(150000));
  it('ส่วนลดกลุ่มใหญ่ ปัดลงเป็นบาท', () => expect(pricePerPersonFor('2026-12-10', 15, S, rules)).toBe(76500));
  it('ส่วนลดซ้อนราคาเทศกาล', () => expect(pricePerPersonFor('2026-12-31', 20, S, rules)).toBe(135000));
  it('quote 2 คืนข้ามเทศกาล', () => {
    const q = quote({ checkIn: '2026-12-30', checkOut: '2027-01-01', adults: 2, children: 1, bookedOn: '2026-12-01' }, S, rules);
    expect(q.total).toBe((120000 + 150000) * 3);
    expect(q.depositDueOn).toBe('2026-12-04');
  });
  it('มัดจำเป็นจำนวนเงิน ต่อคน / ต่อการจอง ไม่เกินยอดรวม', () => {
    const m = (depositMode: 'percent' | 'booking' | 'person', depositAmount = 0, depositPct = 50) => ({ depositMode, depositAmount, depositPct });
    expect(depositFor(1700000, 10, m('percent'))).toBe(850000);
    expect(depositFor(85050, 1, m('percent'))).toBe(42600);
    expect(depositFor(1700000, 10, m('person', 42500))).toBe(425000);
    expect(depositFor(1700000, 10, m('booking', 100000))).toBe(100000);
    expect(depositFor(85000, 1, m('booking', 100000))).toBe(85000);
    expect(depositFor(85000, 1, m('booking', 0))).toBe(0);
    const q = quote({ checkIn: '2026-12-05', checkOut: '2026-12-07', adults: 10, children: 0, bookedOn: '2026-12-01' }, S, []);
    expect(q.deposit).toBe(850000);
    expect(quote({ checkIn: '2026-12-05', checkOut: '2026-12-07', adults: 10, children: 0, bookedOn: '2026-12-01' }, { ...S, ...m('person', 50000) }, []).deposit).toBe(500000);
  });
  it('การจองรุ่นเก่าที่เก็บมัดจำเป็น %', () => {
    expect(bookingDeposit({ total: 1700000, depositPct: 50 } as never)).toBe(850000);
    expect(bookingDeposit({ total: 1700000, deposit: 300000 })).toBe(300000);
  });
  it('มัดจำปัดขึ้นเป็นบาทเต็ม (รุ่นเก่า)', () => {
    expect(depositOf(85050, 50)).toBe(42600);
    expect(depositOf(850000, 50)).toBe(425000);
  });
  it('สถานะชำระ', () => {
    expect(payStatusOf(100, 0)).toBe('unpaid');
    expect(payStatusOf(100, 50)).toBe('deposit');
    expect(payStatusOf(100, 100)).toBe('paid');
  });
});

describe('กันจองเกิน', () => {
  const ctx = (bookings: Booking[]) => ({ rooms: DEFAULT_ROOMS, bookings, closures: [] as never[] });
  it('ห้องเต็มบอกจำนวนที่เหลือ', () => {
    const a = mkBooking({ id: 'a', checkIn: '2026-12-05', checkOut: '2026-12-07', adults: 6 });
    const e = checkBooking({ checkIn: '2026-12-06', checkOut: '2026-12-08', guests: 4, rooms: [{ roomId: 'room-5', guests: 4, whole: false }] }, ctx([a]));
    expect(e).toEqual(['ห้อง 5 รับได้อีก 2 คน ลองเลือกห้องอื่นเพิ่ม']);
  });
  it('เกิน 24 คน', () => {
    const a = mkBooking({ id: 'a', checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 20, rooms: [{ roomId: 'room-5', guests: 8, whole: false }, { roomId: 'room-1', guests: 4, whole: false }, { roomId: 'room-2', guests: 4, whole: false }, { roomId: 'room-3', guests: 4, whole: false }] });
    expect(dayFree('2026-12-05', ctx([a]))).toBe(4);
    const e = checkBooking({ checkIn: '2026-12-05', checkOut: '2026-12-06', guests: 6, rooms: [{ roomId: 'room-4', guests: 6, whole: false }] }, ctx([a]));
    expect(e[0]).toBe('ช่วงนี้รับได้อีก 4 คน (สูงสุด 24 คน) ลดจำนวนคนหรือเลือกวันอื่น');
  });
  it('จองทั้งห้องกันกลุ่มอื่น', () => {
    const a = mkBooking({ id: 'a', checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 2, rooms: [{ roomId: 'room-1', guests: 2, whole: true }] });
    expect(checkBooking({ checkIn: '2026-12-05', checkOut: '2026-12-06', guests: 1, rooms: [{ roomId: 'room-1', guests: 1, whole: false }] }, ctx([a]))[0]).toContain('ห้อง 1 เต็มแล้ว');
  });
  it('ยกเลิกแล้วไม่นับ และแก้ไขการจองตัวเองไม่ชนตัวเอง', () => {
    const a = mkBooking({ id: 'a', checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 8, status: 'cancelled' });
    expect(dayFree('2026-12-05', ctx([a]))).toBe(24);
    const b = mkBooking({ id: 'b', checkIn: '2026-12-05', checkOut: '2026-12-06', adults: 8 });
    expect(checkBooking({ id: 'b', checkIn: '2026-12-05', checkOut: '2026-12-06', guests: 8, rooms: [{ roomId: 'room-5', guests: 8, whole: false }] }, ctx([b]))).toEqual([]);
  });
  it('ปิดห้อง', () => {
    const e = checkBooking({ checkIn: '2026-12-05', checkOut: '2026-12-06', guests: 2, rooms: [{ roomId: 'room-2', guests: 2, whole: false }] }, { rooms: DEFAULT_ROOMS, bookings: [], closures: [{ id: 'c', roomId: 'room-2', start: '2026-12-05', end: '2026-12-05', reason: 'ซ่อมหลังคา' }] });
    expect(e[0]).toBe('ห้อง 2 ปิดในช่วงนี้ (ซ่อมหลังคา) ลองเลือกห้องอื่น');
  });
  it('จัดแขกตามลำดับห้องที่เลือก', () => {
    const free = new Map([['room-5', 8], ['room-1', 4]]);
    expect(autoAllocate(['room-5', 'room-1'], 10, free, () => false)).toEqual([{ roomId: 'room-5', guests: 8, whole: false }, { roomId: 'room-1', guests: 2, whole: false }]);
  });
});

describe('รูปแบบไทย', () => {
  it('วันที่ พ.ศ.', () => {
    expect(fmtDate('2026-11-21')).toBe('21 พ.ย. 2569');
    expect(fmtRange('2026-11-21', '2026-11-23')).toBe('21–23 พ.ย. 2569');
    expect(fmtRange('2026-11-30', '2026-12-02')).toBe('30 พ.ย. – 2 ธ.ค. 2569');
    expect(nightsOf('2026-11-30', '2026-12-02')).toEqual(['2026-11-30', '2026-12-01']);
    expect(todayISO(new Date('2026-11-21T18:30:00Z'))).toBe('2026-11-22');
  });
  it('เงินบาท', () => {
    expect(fmtBaht(123400)).toBe('฿1,234');
    expect(fmtBaht(123450)).toBe('฿1,234.50');
    expect(parseBaht('1,234.5')).toBe(123450);
    expect(parseBaht('abc')).toBeNull();
  });
  it('PromptPay payload มี CRC ถูกต้อง', () => {
    const p = promptpayPayload('0812345678', 425000)!;
    expect(p).toContain('0066812345678');
    expect(p).toContain('54074250.00');
    expect(p).toMatch(/6304[0-9A-F]{4}$/);
  });
});
