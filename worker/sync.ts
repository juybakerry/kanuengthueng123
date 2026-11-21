/**
 * ซิงก์ 2 เครื่อง + ใช้งานออฟไลน์ (FR-16, FR-17)
 * - GET  /api/sync?since=N   ส่งรายการที่เปลี่ยนหลัง seq N (แอปเรียกทุกไม่กี่วินาที)
 * - POST /api/mutate         รับคิวงานจากเครื่อง: ตรวจซ้ำ (opId), ตรวจชนกัน (updatedAt), ตรวจความจุ แล้วบันทึกพร้อมประวัติ
 */
import type { Env } from './env';
import type { Session } from './auth';
import { HttpError, json, nowIso, readJson } from './http';
import { randomToken, uuid } from './crypto';
import { CLIENT_TABLES, sanitize, type ClientTable } from './validate';
import { capacityCtx, getRecord, getSettings, toWire, writeStmts, type RecordRow, type WireRecord } from './records';
import { checkBooking, capacityErrorText } from '../src/domain/capacity';
import { addDays, nightsOf, todayISO, fmtRange } from '../src/domain/dates';
import { fmtBaht } from '../src/domain/money';
import { METHOD_LABEL, PAYMENT_KIND_LABEL } from '../src/domain/defaults';
import { isActiveBooking, type Booking, type Payment, type RoomAlloc } from '../src/domain/types';
import { notifyOthers } from './push';

const PAGE = 800;

export async function syncRoute(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const since = Math.max(0, Number(url.searchParams.get('since') ?? 0) || 0);
  const [metaRes, recRes] = await env.DB.batch([
    env.DB.prepare(`SELECT key, value FROM meta WHERE key IN ('seq', 'epoch')`),
    env.DB.prepare('SELECT * FROM records WHERE seq > ? ORDER BY seq LIMIT ?').bind(since, PAGE + 1),
  ]);
  const meta = Object.fromEntries((metaRes!.results as Array<{ key: string; value: string }>).map((r) => [r.key, r.value]));
  const head = Number(meta.seq ?? 0);
  // epoch เปลี่ยนเมื่อกู้คืนข้อมูล → เครื่องต้องโหลดใหม่ทั้งหมด
  const epoch = meta.epoch ?? '0';
  const results = recRes!.results as unknown as RecordRow[];
  const more = results.length > PAGE;
  const rows = results.slice(0, PAGE);
  return json({ epoch, seq: rows.length ? rows[rows.length - 1]!.seq : Math.min(since, head), head, more, records: rows.map(toWire), now: nowIso() });
}

interface Op {
  opId: string;
  tbl: ClientTable;
  id: string;
  data: Record<string, unknown>;
  /** updatedAt ที่เครื่องเห็นล่าสุด (null = รายการใหม่) */
  base: string | null;
  delete?: boolean;
  /** ผู้ใช้เลือก "ใช้ข้อมูลของฉัน" หลังเห็นข้อมูลชนกัน */
  force?: boolean;
  summary?: string;
}

type OpResult =
  | { opId: string; status: 'ok' | 'dup'; record?: WireRecord }
  | { opId: string; status: 'conflict'; record: WireRecord | null; error: string }
  | { opId: string; status: 'rejected'; record: WireRecord | null; error: string };

export async function mutateRoute(req: Request, env: Env, s: Session, ctx: ExecutionContext): Promise<Response> {
  const body = await readJson<{ ops?: Op[] }>(req, 4_000_000);
  const ops = Array.isArray(body.ops) ? body.ops.slice(0, 25) : [];
  const results: OpResult[] = [];
  const events: Array<{ title: string; body: string; url: string; tag: string }> = [];
  for (const op of ops) {
    try {
      results.push(await applyOp(env, s, op, events));
    } catch (e) {
      const msg = e instanceof HttpError ? e.message : 'บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง';
      if (!(e instanceof HttpError)) console.error('op failed', op.tbl, op.id, e);
      const cur = op?.tbl && op?.id ? await getRecord(env.DB, op.tbl, op.id).catch(() => null) : null;
      results.push({ opId: String(op?.opId ?? ''), status: 'rejected', record: cur ? toWire(cur) : null, error: msg });
    }
  }
  if (events.length) ctx.waitUntil(notifyOthers(env, s.tokenHash, events).catch((e) => console.error('push', e)));
  return json({ results });
}

async function applyOp(env: Env, s: Session, op: Op, events: Array<{ title: string; body: string; url: string; tag: string }>): Promise<OpResult> {
  if (!op || typeof op.opId !== 'string' || op.opId.length < 8 || op.opId.length > 80) throw new HttpError(400, 'คิวงานไม่ถูกต้อง', 'VALIDATION');
  if (!CLIENT_TABLES.includes(op.tbl)) throw new HttpError(400, 'ประเภทข้อมูลไม่ถูกต้อง', 'VALIDATION');
  if (typeof op.id !== 'string' || !/^[\w-]{1,64}$/.test(op.id)) throw new HttpError(400, 'รหัสรายการไม่ถูกต้อง', 'VALIDATION');
  if (op.tbl === 'settings' && op.id !== 'main') throw new HttpError(400, 'รหัสรายการไม่ถูกต้อง', 'VALIDATION');

  const dup = await env.DB.prepare('SELECT result FROM ops WHERE op_id = ?').bind(op.opId).first<{ result: string }>();
  const curRow = await getRecord(env.DB, op.tbl, op.id);
  if (dup) return { opId: op.opId, status: 'dup', record: curRow ? toWire(curRow) : undefined };

  const cur = curRow ? (JSON.parse(curRow.data) as Record<string, unknown>) : null;
  if (curRow && !op.force && op.base !== curRow.updated_at) {
    return { opId: op.opId, status: 'conflict', record: toWire(curRow), error: 'อีกเครื่องแก้ไขรายการนี้ไปก่อนแล้ว' };
  }
  if (op.tbl === 'surveys' && !op.delete) throw new HttpError(403, 'แบบประเมินแก้ไขจากแอปไม่ได้', 'FORBIDDEN');

  const now = nowIso();
  const deletedAt = op.delete ? now : null;
  let data = op.delete && cur ? cur : sanitize(op.tbl, op.data ?? {});
  const stmts: D1PreparedStatement[] = [];
  let summary = String(op.summary ?? '').slice(0, 200);

  if (op.tbl === 'bookings') {
    const b = data as unknown as Booking;
    const prev = cur as unknown as Booking | null;
    if (prev) {
      // ค่าที่เซิร์ฟเวอร์เป็นผู้กำหนด
      b.code = prev.code;
      b.surveyToken = prev.surveyToken;
      b.createdBy = prev.createdBy;
      b.createdAt = prev.createdAt;
    } else {
      b.code = await nextBookingCode(env.DB, todayISO());
      b.surveyToken = randomToken(12);
      b.createdBy = s.user.displayName;
      b.createdAt = now;
    }
    if ((b.status === 'cancelled' || b.status === 'no_show') && !b.cancelledOn) b.cancelledOn = todayISO();
    const wasActive = prev ? isActiveBooking(prev) : false;
    const active = !op.delete && isActiveBooking(b);
    const changedNights = !prev || wasActive !== active || prev.checkIn !== b.checkIn || prev.checkOut !== b.checkOut || JSON.stringify(prev.rooms) !== JSON.stringify(b.rooms);
    if (changedNights) {
      if (active) {
        const ctx = await capacityCtx(env.DB, b.checkIn, b.checkOut);
        const errs = checkBooking({ id: op.id, checkIn: b.checkIn, checkOut: b.checkOut, guests: b.adults + b.children, rooms: b.rooms }, ctx);
        if (errs.length) throw new HttpError(409, errs[0]!, 'CAPACITY');
      }
      stmts.push(env.DB.prepare('DELETE FROM booking_nights WHERE booking_id = ?').bind(op.id));
      if (active) stmts.push(...nightStmts(env.DB, op.id, b.checkIn, b.checkOut, b.rooms));
    }
    if (!summary) summary = prev ? (op.delete ? 'ลบการจอง' : 'แก้ไขการจอง') : `สร้างการจอง ${fmtRange(b.checkIn, b.checkOut)}`;
    if (!prev && b.status !== 'pending') events.push({ title: 'มีการจองใหม่', body: `${b.name} · ${fmtRange(b.checkIn, b.checkOut)} · ${b.adults + b.children} คน · ${fmtBaht(b.total)} (โดย ${s.user.displayName})`, url: `/bookings?b=${op.id}`, tag: `booking-${op.id}` });
    else if (prev && prev.total !== b.total) events.push({ title: 'แก้ไขยอดเงินการจอง', body: `${b.name} · ยอดรวม ${fmtBaht(prev.total)} → ${fmtBaht(b.total)} (โดย ${s.user.displayName})`, url: `/bookings?b=${op.id}`, tag: `booking-${op.id}` });
    data = b as unknown as Record<string, unknown>;
  } else if (op.tbl === 'payments') {
    const p = data as unknown as Payment;
    const prev = cur as unknown as Payment | null;
    p.recordedBy = prev?.recordedBy || s.user.displayName;
    p.createdAt = prev?.createdAt || now;
    const bk = await getRecord(env.DB, 'bookings', p.bookingId);
    if (!bk) throw new HttpError(409, 'ไม่พบการจองของรายการเงินนี้ (อาจถูกลบ) รีเฟรชแล้วลองใหม่', 'MISSING');
    const bname = (JSON.parse(bk.data) as Booking).name;
    if (!summary) summary = op.delete ? `ลบรายการ${PAYMENT_KIND_LABEL[p.kind]} ${fmtBaht(p.amount)}` : `${prev ? 'แก้ไข' : 'บันทึก'}${PAYMENT_KIND_LABEL[p.kind]} ${fmtBaht(p.amount)} (${METHOD_LABEL[p.method]})`;
    events.push({ title: op.delete ? 'ลบรายการเงิน' : p.kind === 'refund' ? 'คืนเงินลูกค้า' : 'รับชำระเงิน', body: `${bname} · ${summary} (โดย ${s.user.displayName})`, url: `/bookings?b=${p.bookingId}`, tag: `pay-${p.bookingId}` });
    data = p as unknown as Record<string, unknown>;
  } else if (op.tbl === 'issues' || op.tbl === 'customers' || op.tbl === 'requests') {
    const prev = cur as { createdAt?: string; reportedBy?: string } | null;
    (data as { createdAt?: string }).createdAt = prev?.createdAt || now;
    if (op.tbl === 'issues') (data as { reportedBy?: string }).reportedBy = prev?.reportedBy || s.user.displayName;
  } else if (op.tbl === 'closures' && !op.delete) {
    const c = data as { roomId: string | null; start: string; end: string };
    // ห้ามปิดช่วงที่มีแขกจองแล้ว (แจ้งชื่อให้จัดการก่อน)
    const ctx = await capacityCtx(env.DB, c.start, addDays(c.end, 1));
    const hit = ctx.bookings.find((b) => b.checkIn <= c.end && b.checkOut > c.start && (c.roomId == null || b.rooms.some((r) => r.roomId === c.roomId)));
    if (hit) throw new HttpError(409, `ช่วงนี้มีการจองของ ${hit.name} (${fmtRange(hit.checkIn, hit.checkOut)}) ย้ายห้องหรือเลื่อนวันก่อน แล้วค่อยปิด`, 'CAPACITY');
  } else if (op.tbl === 'rooms' && !op.delete) {
    const r = data as { capacity: number; isActive: boolean };
    const prev = cur as { capacity: number; isActive: boolean } | null;
    if (prev && (r.capacity < prev.capacity || (!r.isActive && prev.isActive))) {
      const max = await env.DB.prepare(`SELECT MAX(t) AS m FROM (SELECT SUM(guests) AS t FROM booking_nights WHERE room_id = ? AND night >= ? GROUP BY night)`).bind(op.id, todayISO()).first<{ m: number | null }>();
      if ((max?.m ?? 0) > (r.isActive ? r.capacity : 0)) throw new HttpError(409, `ห้องนี้มีการจอง ${max?.m} คนในอนาคต ลดความจุหรือปิดห้องไม่ได้จนกว่าจะย้ายแขก`, 'CAPACITY');
    }
  }

  stmts.push(...writeStmts(env.DB, op.tbl, op.id, data, now, deletedAt));
  if (['bookings', 'payments', 'issues', 'settings', 'closures', 'priceRules', 'rooms', 'fixedCosts', 'customers', 'requests'].includes(op.tbl)) {
    const auditId = uuid();
    const rowId = op.tbl === 'payments' ? String((data as { bookingId?: string }).bookingId) : op.id;
    const entry = { tableName: op.tbl, rowId, action: op.delete ? 'delete' : cur ? 'update' : 'insert', summary: summary || defaultSummary(op.tbl, !!cur, !!op.delete), actor: s.user.displayName, device: s.device, at: now };
    stmts.push(...writeStmts(env.DB, 'audit', auditId, entry, now, null));
    stmts.push(
      env.DB.prepare('INSERT INTO audit_log (id, table_name, row_id, action, before, after, actor, device, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(auditId, op.tbl, op.id, entry.action, cur ? JSON.stringify(cur) : null, op.delete ? null : JSON.stringify(data), s.user.displayName, s.device, now),
    );
  }
  stmts.push(env.DB.prepare('INSERT INTO ops (op_id, result, at) VALUES (?, ?, ?)').bind(op.opId, 'ok', now));

  try {
    await env.DB.batch(stmts);
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    if (/ROOM_FULL|HOUSE_FULL|WHOLE_ROOM|CLOSED/.test(m)) throw new HttpError(409, capacityErrorText(m), 'CAPACITY');
    if (/UNIQUE constraint failed: ops/.test(m)) return { opId: op.opId, status: 'dup' };
    throw e;
  }
  const row = await getRecord(env.DB, op.tbl, op.id);
  return { opId: op.opId, status: 'ok', record: row ? toWire(row) : undefined };
}

function defaultSummary(tbl: string, existed: boolean, del: boolean): string {
  const names: Record<string, string> = { settings: 'ตั้งค่า', closures: 'ปิดห้อง/ปิดวัน', priceRules: 'ราคาพิเศษ', rooms: 'ห้องพัก', fixedCosts: 'ต้นทุนคงที่', customers: 'ข้อมูลลูกค้า', issues: 'แจ้งปัญหา', requests: 'คำขอจองออนไลน์' };
  return `${del ? 'ลบ' : existed ? 'แก้ไข' : 'เพิ่ม'}${names[tbl] ?? 'ข้อมูล'}`;
}

function nightStmts(db: D1Database, bookingId: string, checkIn: string, checkOut: string, rooms: RoomAlloc[]): D1PreparedStatement[] {
  const rows: Array<[string, string, string, number, number]> = [];
  for (const night of nightsOf(checkIn, checkOut)) for (const r of rooms) if (r.guests > 0 || r.whole) rows.push([bookingId, r.roomId, night, r.guests, r.whole ? 1 : 0]);
  const out: D1PreparedStatement[] = [];
  for (let i = 0; i < rows.length; i += 18) {
    const chunk = rows.slice(i, i + 18);
    out.push(db.prepare(`INSERT INTO booking_nights (booking_id, room_id, night, guests, whole) VALUES ${chunk.map(() => '(?, ?, ?, ?, ?)').join(', ')}`).bind(...chunk.flat()));
  }
  return out;
}

/** เลขที่การจอง KT-2569-0001 (เรียงต่อเนื่องในแต่ละปี พ.ศ.) */
async function nextBookingCode(db: D1Database, today: string): Promise<string> {
  const be = Number(today.slice(0, 4)) + 543;
  const key = `code:${be}`;
  const row = await db
    .prepare(`INSERT INTO meta (key, value) VALUES (?, '1') ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1 RETURNING value`)
    .bind(key)
    .first<{ value: string }>();
  return `KT-${be}-${String(row?.value ?? 1).padStart(4, '0')}`;
}

export { getSettings };
