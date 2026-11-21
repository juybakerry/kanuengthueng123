/**
 * กำไร-ขาดทุนของช่วงเวลา (SRS 5.2, Requirement Form ส่วนที่ 4, 7, 8)
 * - รายรับรับรู้ตามคืนที่เข้าพัก · ค่าอาหาร = ค่าอาหาร × แขก × คืน
 * - ค่าแม่บ้าน = ค่าแม่บ้าน × จำนวนวันที่มีแขกพักอย่างน้อย 1 คน (คิดรวมระดับวัน)
 * - ค่ารถ = ค่ารถ × แขก (เฉพาะการจองที่ใช้รถ) รับรู้ในวันเช็คอิน
 * - ค่าใช้จ่ายจากปัญหา ตามวันที่จ่าย · เงินเรียกคืนจากลูกค้า นับเป็นรายรับ
 * - ยกเลิก: มัดจำไม่คืน นับเป็นรายรับของวันที่ยกเลิก
 * - ต้นทุนคงที่รายเดือน เฉลี่ยรายวันตามจำนวนวันของเดือน
 */
import { daysInMonth, daysInclusive } from './dates';
import { activeRooms } from './capacity';
import { dueOf, guestsOf, paidOf } from './pricing';
import { isActiveBooking } from './types';
import type { Booking, Channel, Dataset, ISODate, Satang } from './types';

export interface NightAmount {
  date: ISODate;
  amount: Satang;
}

/** รายรับของการจองแยกตามคืน (กระจายส่วนลด/รายการเพิ่มเท่า ๆ กัน เศษไว้คืนแรก) */
export function bookingNightRevenue(b: Pick<Booking, 'nightly' | 'adults' | 'children' | 'discount' | 'extra'>): NightAmount[] {
  const g = guestsOf(b);
  const n = b.nightly.length;
  if (!n) return [];
  const adj = (b.extra ?? 0) - (b.discount ?? 0);
  const share = Math.trunc(adj / n);
  const rem = adj - share * n;
  return b.nightly.map((x, i) => ({ date: x.date, amount: x.price * g + share + (i === 0 ? rem : 0) }));
}

export interface ReportData extends Pick<Dataset, 'rooms' | 'bookings' | 'payments' | 'issues' | 'fixedCosts'> {
  housekeepingCost: Satang;
}

export interface Report {
  from: ISODate;
  to: ISODate;
  days: number;
  revenueStay: Satang;
  forfeits: Satang;
  recovered: Satang;
  revenue: Satang;
  meal: Satang;
  housekeeping: Satang;
  transport: Satang;
  issueCost: Satang;
  fixed: Satang;
  costTotal: Satang;
  profit: Satang;
  guestNights: number;
  roomNights: number;
  occupiedDays: number;
  occupancyPeople: number;
  occupancyRooms: number;
  arrivals: number;
  arrivalGuests: number;
  outstanding: Satang;
  outstandingCount: number;
  revenueByDay: Map<ISODate, Satang>;
  roomNightsByRoom: Map<string, number>;
  channelCount: Map<Channel, number>;
}

export function report(from: ISODate, to: ISODate, data: ReportData): Report {
  const inRange = (d: ISODate | null | undefined) => !!d && from <= d && d <= to;
  const days = daysInclusive(from, to);
  const revenueByDay = new Map<ISODate, Satang>(days.map((d) => [d, 0]));
  const roomNightsByRoom = new Map<string, number>();
  const channelCount = new Map<Channel, number>();
  const occupiedNights = new Set<ISODate>();
  const roomNightKeys = new Set<string>();
  let revenueStay = 0;
  let meal = 0;
  let transport = 0;
  let forfeits = 0;
  let guestNights = 0;
  let arrivals = 0;
  let arrivalGuests = 0;
  let outstanding = 0;
  let outstandingCount = 0;

  for (const b of data.bookings) {
    if (b.deletedAt) continue;
    const g = guestsOf(b);
    if (b.status === 'cancelled' || b.status === 'no_show') {
      const kept = paidOf(b.id, data.payments);
      if (kept > 0 && inRange(b.cancelledOn ?? b.checkIn)) {
        forfeits += kept;
        const d = (b.cancelledOn ?? b.checkIn) as ISODate;
        revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + kept);
      }
      continue;
    }
    if (!isActiveBooking(b)) continue;
    for (const n of bookingNightRevenue(b)) {
      if (!inRange(n.date)) continue;
      revenueStay += n.amount;
      revenueByDay.set(n.date, (revenueByDay.get(n.date) ?? 0) + n.amount);
      meal += b.mealCost * g;
      guestNights += g;
      if (g > 0) occupiedNights.add(n.date);
      for (const a of b.rooms) {
        if (a.guests <= 0 && !a.whole) continue;
        roomNightKeys.add(`${a.roomId}|${n.date}`);
        roomNightsByRoom.set(a.roomId, (roomNightsByRoom.get(a.roomId) ?? 0) + 1);
      }
    }
    if (inRange(b.checkIn)) {
      if (b.usesTransport) transport += b.transportCost * g;
      arrivals += 1;
      arrivalGuests += g;
      channelCount.set(b.channel, (channelCount.get(b.channel) ?? 0) + 1);
      const due = dueOf(b.total, paidOf(b.id, data.payments));
      if (due > 0) {
        outstanding += due;
        outstandingCount += 1;
      }
    }
  }

  let issueCost = 0;
  let recovered = 0;
  for (const i of data.issues) {
    if (i.deletedAt) continue;
    if (inRange(i.paidOn ?? i.occurredOn)) issueCost += i.amount;
    if (i.recover > 0) {
      const d = i.recoverOn ?? i.paidOn ?? i.occurredOn;
      if (inRange(d)) {
        recovered += i.recover;
        revenueByDay.set(d, (revenueByDay.get(d) ?? 0) + i.recover);
      }
    }
  }

  let fixedF = 0;
  for (const d of days) {
    const ym = d.slice(0, 7);
    for (const f of data.fixedCosts) {
      if (f.deletedAt || f.amount <= 0) continue;
      if (f.effectiveFrom > ym || (f.effectiveTo && f.effectiveTo < ym)) continue;
      fixedF += f.amount / daysInMonth(ym);
    }
  }
  const fixed = Math.round(fixedF);

  const housekeeping = occupiedNights.size * data.housekeepingCost;
  const rooms = activeRooms(data.rooms);
  const capPeople = rooms.reduce((s, r) => s + r.capacity, 0);
  const revenue = revenueStay + forfeits + recovered;
  const costTotal = meal + housekeeping + transport + issueCost + fixed;
  return {
    from,
    to,
    days: days.length,
    revenueStay,
    forfeits,
    recovered,
    revenue,
    meal,
    housekeeping,
    transport,
    issueCost,
    fixed,
    costTotal,
    profit: revenue - costTotal,
    guestNights,
    roomNights: roomNightKeys.size,
    occupiedDays: occupiedNights.size,
    occupancyPeople: capPeople && days.length ? (guestNights / (capPeople * days.length)) * 100 : 0,
    occupancyRooms: rooms.length && days.length ? (roomNightKeys.size / (rooms.length * days.length)) * 100 : 0,
    arrivals,
    arrivalGuests,
    outstanding,
    outstandingCount,
    revenueByDay,
    roomNightsByRoom,
    channelCount,
  };
}

/** ต้นทุนเฉพาะของการจองหนึ่ง (ใช้แสดงในรายละเอียด/ตัวอย่างการคำนวณ) — แม่บ้านคิด 1 วันต่อคืนที่พัก */
export function bookingCosts(b: Booking, housekeepingCost: Satang) {
  const g = guestsOf(b);
  const n = b.nightly.length;
  const meal = b.mealCost * g * n;
  const housekeeping = housekeepingCost * n;
  const transport = b.usesTransport ? b.transportCost * g : 0;
  return { meal, housekeeping, transport, total: meal + housekeeping + transport, profit: b.total - meal - housekeeping - transport };
}
