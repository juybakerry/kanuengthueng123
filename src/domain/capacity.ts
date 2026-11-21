/**
 * ห้องว่างและการกันจองเกิน (SRS 5.4)
 * ทุกคืน: แขกในแต่ละห้อง ≤ ความจุห้อง · แขกทั้งโฮมสเตย์ ≤ ความจุรวม (24)
 * ห้องที่จอง "ทั้งห้อง" ห้ามมีการจองอื่นในคืนเดียวกัน · ห้อง/วันที่ปิด ห้ามจอง · การจองที่ยกเลิกไม่นับ
 */
import { nightsOf } from './dates';
import { isActiveBooking } from './types';
import type { Booking, Closure, ISODate, Room, RoomAlloc } from './types';

export interface CapacityCtx {
  rooms: Room[];
  bookings: Booking[];
  closures: Closure[];
}

export const activeRooms = (rooms: Room[]) => rooms.filter((r) => r.isActive && !r.deletedAt).sort((a, b) => a.sortOrder - b.sortOrder);
export const houseCapacity = (rooms: Room[]) => activeRooms(rooms).reduce((s, r) => s + r.capacity, 0);

export function closureFor(date: ISODate, roomId: string, closures: Closure[]): Closure | undefined {
  return closures.find((c) => !c.deletedAt && c.start <= date && date <= c.end && (c.roomId == null || c.roomId === roomId));
}

export function houseClosed(date: ISODate, closures: Closure[]): Closure | undefined {
  return closures.find((c) => !c.deletedAt && c.roomId == null && c.start <= date && date <= c.end);
}

export interface RoomUse {
  guests: number;
  whole: boolean;
  bookings: Booking[];
}

/** การใช้ห้องในคืนหนึ่ง (ไม่นับการจองที่ excludeId) */
export function usageOn(date: ISODate, bookings: Booking[], excludeId?: string): Map<string, RoomUse> {
  const m = new Map<string, RoomUse>();
  for (const b of bookings) {
    if (b.id === excludeId || !isActiveBooking(b)) continue;
    if (!(b.checkIn <= date && date < b.checkOut)) continue;
    for (const a of b.rooms) {
      const u = m.get(a.roomId) ?? { guests: 0, whole: false, bookings: [] };
      u.guests += a.guests;
      u.whole = u.whole || a.whole;
      u.bookings.push(b);
      m.set(a.roomId, u);
    }
  }
  return m;
}

/** ที่ว่างของห้องในคืนหนึ่ง */
export function roomFree(date: ISODate, room: Room, ctx: CapacityCtx, excludeId?: string, use = usageOn(date, ctx.bookings, excludeId)): number {
  if (!room.isActive || room.deletedAt) return 0;
  if (closureFor(date, room.id, ctx.closures)) return 0;
  const u = use.get(room.id);
  if (!u) return room.capacity;
  if (u.whole) return 0;
  return Math.max(0, room.capacity - u.guests);
}

/** ที่ว่างทั้งโฮมสเตย์ในคืนหนึ่ง */
export function dayFree(date: ISODate, ctx: CapacityCtx, excludeId?: string): number {
  const use = usageOn(date, ctx.bookings, excludeId);
  return activeRooms(ctx.rooms).reduce((s, r) => s + roomFree(date, r, ctx, excludeId, use), 0);
}

export function dayUsed(date: ISODate, bookings: Booking[]): number {
  let n = 0;
  for (const u of usageOn(date, bookings).values()) n += u.guests;
  return n;
}

/** ที่ว่างน้อยที่สุดของห้องตลอดช่วงคืน */
export function minRoomFree(nights: ISODate[], room: Room, ctx: CapacityCtx, excludeId?: string): number {
  if (!nights.length) return room.capacity;
  return Math.min(...nights.map((d) => roomFree(d, room, ctx, excludeId)));
}

export function minDayFree(nights: ISODate[], ctx: CapacityCtx, excludeId?: string): number {
  if (!nights.length) return houseCapacity(ctx.rooms);
  return Math.min(...nights.map((d) => dayFree(d, ctx, excludeId)));
}

/** ห้องว่างทั้งห้อง (ไม่มีแขกเลย) ตลอดช่วง */
export function roomEmptyAllNights(nights: ISODate[], room: Room, ctx: CapacityCtx, excludeId?: string): boolean {
  return nights.every((d) => roomFree(d, room, ctx, excludeId) === room.capacity);
}

/** จัดแขกลงห้องที่เลือกตามลำดับที่เลือก ไม่เกินที่ว่างของแต่ละห้อง (ห้องสุดท้ายรับส่วนที่เหลือ เพื่อให้ตัวตรวจแจ้งเตือนได้) */
export function autoAllocate(selected: string[], guests: number, freeByRoom: Map<string, number>, whole: (roomId: string) => boolean): RoomAlloc[] {
  let left = guests;
  const out: RoomAlloc[] = [];
  selected.forEach((roomId, i) => {
    const free = freeByRoom.get(roomId) ?? 0;
    const last = i === selected.length - 1;
    const n = last ? left : Math.min(free, left);
    out.push({ roomId, guests: Math.max(0, n), whole: whole(roomId) });
    left -= Math.max(0, n);
  });
  return out.filter((a, i) => a.guests > 0 || i === 0);
}

export interface CheckInput {
  id?: string;
  checkIn: ISODate;
  checkOut: ISODate;
  guests: number;
  rooms: RoomAlloc[];
}

/** ตรวจการจอง คืนข้อความภาษาไทยพร้อมคำแนะนำ (ว่าง = ผ่าน) */
export function checkBooking(input: CheckInput, ctx: CapacityCtx): string[] {
  const errors: string[] = [];
  const nights = nightsOf(input.checkIn, input.checkOut);
  if (!nights.length) return ['วันเช็คเอาท์ต้องอยู่หลังวันเช็คอิน เลือกวันออกใหม่'];
  if (input.guests < 1) return ['ใส่จำนวนผู้เข้าพักอย่างน้อย 1 คน'];
  const roomsById = new Map(ctx.rooms.map((r) => [r.id, r]));
  const allocated = input.rooms.reduce((s, a) => s + a.guests, 0);
  const cap = houseCapacity(ctx.rooms);

  for (const d of nights) {
    const c = houseClosed(d, ctx.closures);
    if (c) return [`ปิดรับแขกวันที่ ${d.slice(8).replace(/^0/, '')}/${d.slice(5, 7)}${c.reason ? ` (${c.reason})` : ''} เลือกวันอื่น`];
  }
  const houseFree = minDayFree(nights, ctx, input.id);
  if (input.guests > houseFree) {
    errors.push(houseFree <= 0 ? `ช่วงนี้เต็มแล้ว (สูงสุด ${cap} คน) ลองเลือกวันอื่น` : `ช่วงนี้รับได้อีก ${houseFree} คน (สูงสุด ${cap} คน) ลดจำนวนคนหรือเลือกวันอื่น`);
  }
  if (!input.rooms.length) {
    errors.push('ยังไม่ได้เลือกห้อง แตะห้องที่ต้องการ');
    return errors;
  }
  for (const a of input.rooms) {
    const room = roomsById.get(a.roomId);
    if (!room) {
      errors.push('ห้องที่เลือกไม่มีในระบบแล้ว เลือกห้องใหม่');
      continue;
    }
    const closed = nights.map((d) => closureFor(d, room.id, ctx.closures)).find(Boolean);
    if (closed && closed.roomId != null) {
      errors.push(`${room.name} ปิดในช่วงนี้${closed.reason ? ` (${closed.reason})` : ''} ลองเลือกห้องอื่น`);
      continue;
    }
    if (a.whole && !roomEmptyAllNights(nights, room, ctx, input.id)) {
      errors.push(`${room.name} มีแขกกลุ่มอื่นพักแล้ว จองทั้งห้องไม่ได้ เปลี่ยนเป็นจองรายคนหรือเลือกห้องอื่น`);
      continue;
    }
    const free = minRoomFree(nights, room, ctx, input.id);
    if (a.guests > free) {
      errors.push(free <= 0 ? `${room.name} เต็มแล้วในช่วงนี้ ลองเลือกห้องอื่น` : `${room.name} รับได้อีก ${free} คน ลองเลือกห้องอื่นเพิ่ม`);
    }
  }
  if (allocated < input.guests && errors.length === 0) {
    const freeSel = input.rooms.reduce((s, a) => {
      const r = roomsById.get(a.roomId);
      return s + (r ? minRoomFree(nights, r, ctx, input.id) : 0);
    }, 0);
    errors.push(input.rooms.length === 1 ? `${roomsById.get(input.rooms[0]!.roomId)?.name ?? 'ห้องนี้'} รับได้อีก ${freeSel} คน ลองเลือกห้องอื่นเพิ่ม` : `ห้องที่เลือกรับได้อีก ${freeSel} คน ลองเลือกห้องอื่นเพิ่ม`);
  }
  return [...new Set(errors)];
}

/** แปลงรหัสข้อผิดพลาดจาก trigger ฐานข้อมูลเป็นภาษาไทย */
export function capacityErrorText(code: string): string {
  if (code.includes('ROOM_FULL')) return 'ห้องที่เลือกเต็มแล้ว (อีกเครื่องเพิ่งบันทึกการจอง) เลือกห้องหรือจำนวนคนใหม่';
  if (code.includes('HOUSE_FULL')) return 'โฮมสเตย์เต็มแล้วในช่วงนี้ (อีกเครื่องเพิ่งบันทึกการจอง) ลดจำนวนคนหรือเลือกวันอื่น';
  if (code.includes('WHOLE_ROOM')) return 'ห้องนี้ถูกจองทั้งห้องหรือมีแขกกลุ่มอื่นแล้ว เลือกห้องอื่น';
  if (code.includes('CLOSED')) return 'ห้องหรือวันที่เลือกถูกปิดไว้ เลือกวันหรือห้องอื่น';
  return 'บันทึกไม่ได้เพราะห้องไม่ว่าง ลองเลือกใหม่';
}
