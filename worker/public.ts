/**
 * หน้าสาธารณะสำหรับลูกค้า (ไม่ต้องเข้าสู่ระบบ)
 * - /api/public/info, /availability: แสดงแค่ ว่าง/เต็ม ไม่มีข้อมูลลูกค้า (FR-22)
 * - /api/public/request: ส่งคำขอจอง → พนักงานยืนยันในแอป (กันสแปมด้วยจำกัดจำนวน + Turnstile ถ้าตั้งค่า)
 * - /api/public/booking/:token, /survey/:token: หน้าชำระเงินและแบบประเมินของแต่ละการจอง (FR-23)
 */
import type { Env } from './env';
import { HttpError, clientIp, json, nowIso, rateLimit, readJson } from './http';
import { uuid } from './crypto';
import { capacityCtx, getSettings, listTable, writeStmts } from './records';
import { dayFree, houseCapacity, houseClosed } from '../src/domain/capacity';
import { addDays, daysInclusive, fmtRange, todayISO } from '../src/domain/dates';
import { bookingDeposit, dueOf, paidOf, payStatusOf, quote } from '../src/domain/pricing';
import { promptpayPayload } from '../src/domain/promptpay';
import type { Booking, Payment, PriceRule } from '../src/domain/types';
import { notifyAll } from './push';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function publicRoute(req: Request, env: Env, path: string, ctx: ExecutionContext): Promise<Response> {
  if (path === '/api/public/info' && req.method === 'GET') {
    const st = await getSettings(env.DB);
    const rooms = await listTable<{ capacity: number; isActive: boolean; sortOrder: number; name: string; kind: string; deletedAt?: string }>(env.DB, 'rooms');
    return json(
      {
        homestay: st.homestay,
        pricePerPerson: st.pricePerPerson,
        depositMode: st.depositMode,
        depositPct: st.depositPct,
        depositAmount: st.depositAmount,
        depositDueDays: st.depositDueDays,
        checkInTime: st.checkInTime,
        checkOutTime: st.checkOutTime,
        publicBooking: st.publicBooking,
        capacity: rooms.filter((r) => r.isActive).reduce((s, r) => s + r.capacity, 0),
        rooms: rooms.filter((r) => r.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => ({ name: r.name, kind: r.kind, capacity: r.capacity })),
        turnstileSiteKey: env.TURNSTILE_SECRET ? (env.TURNSTILE_SITE_KEY ?? '') : '',
      },
      200,
      { 'Cache-Control': 'public, max-age=60' },
    );
  }
  if (path === '/api/public/availability' && req.method === 'GET') {
    const url = new URL(req.url);
    const today = todayISO();
    let from = url.searchParams.get('from') ?? today;
    if (!DATE_RE.test(from) || from < today) from = today;
    const days = Math.min(120, Math.max(1, Number(url.searchParams.get('days') ?? 62) || 62));
    const to = addDays(from, days);
    const c = await capacityCtx(env.DB, from, to);
    const cap = houseCapacity(c.rooms);
    const list = daysInclusive(from, addDays(to, -1)).map((d) => ({ date: d, free: dayFree(d, c), closed: !!houseClosed(d, c.closures) }));
    return json({ capacity: cap, days: list }, 200, { 'Cache-Control': 'public, max-age=30' });
  }
  if (path === '/api/public/quote' && req.method === 'POST') {
    const b = await readJson<{ checkIn: string; checkOut: string; adults: number; children: number }>(req, 10_000);
    if (!DATE_RE.test(b.checkIn) || !DATE_RE.test(b.checkOut) || b.checkOut <= b.checkIn) throw new HttpError(400, 'เลือกวันเข้าพักและวันออกก่อน', 'VALIDATION');
    const st = await getSettings(env.DB);
    const rules = await listTable<PriceRule>(env.DB, 'priceRules');
    const q = quote({ checkIn: b.checkIn, checkOut: b.checkOut, adults: Math.max(0, Math.min(99, Number(b.adults) || 0)), children: Math.max(0, Math.min(99, Number(b.children) || 0)), bookedOn: todayISO() }, st, rules);
    return json({ total: q.total, nights: q.nights, deposit: q.deposit });
  }
  if (path === '/api/public/request' && req.method === 'POST') return createRequest(req, env, ctx);

  const m = path.match(/^\/api\/public\/(booking|survey)\/([\w-]{8,40})$/);
  if (m) {
    const [, kind, token] = m;
    const bks = await listTable<Booking>(env.DB, 'bookings', `AND json_extract(data, '$.surveyToken') = ?`, token);
    const b = bks[0];
    if (!b) throw new HttpError(404, 'ไม่พบการจองนี้ ลิงก์อาจไม่ถูกต้อง', 'NOT_FOUND');
    const surveys = await listTable<{ bookingId: string }>(env.DB, 'surveys', `AND json_extract(data, '$.bookingId') = ?`, b.id);
    if (kind === 'booking' && req.method === 'GET') {
      const st = await getSettings(env.DB);
      const payments = await listTable<Payment>(env.DB, 'payments', `AND json_extract(data, '$.bookingId') = ?`, b.id);
      const paid = paidOf(b.id, payments);
      const due = dueOf(b.total, paid);
      const deposit = bookingDeposit(b);
      const payNow = paid <= 0 ? deposit : due;
      return json({
        name: b.name,
        code: b.code,
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        guests: b.adults + b.children,
        status: b.status,
        total: b.total,
        paid,
        due,
        deposit,
        depositDueOn: b.depositDueOn,
        payStatus: payStatusOf(b.total, paid),
        payNow,
        qr: st.promptpayId && payNow > 0 && b.status !== 'cancelled' ? promptpayPayload(st.promptpayId, payNow) : null,
        promptpayName: st.promptpayName,
        bankAccount: st.bankAccount,
        homestay: st.homestay,
        checkInTime: st.checkInTime,
        checkOutTime: st.checkOutTime,
        surveyDone: surveys.length > 0,
      });
    }
    if (kind === 'survey' && req.method === 'GET') return json({ name: b.name, range: fmtRange(b.checkIn, b.checkOut), done: surveys.length > 0 });
    if (kind === 'survey' && req.method === 'POST') {
      if (!(await rateLimit(env.DB, `survey:${clientIp(req)}`, 10, 3600))) throw new HttpError(429, 'ส่งบ่อยเกินไป ลองใหม่ภายหลังเน้อ', 'RATE');
      if (surveys.length) return json({ ok: true, already: true });
      const body = await readJson<{ score: number; tags?: string[]; comment?: string }>(req, 10_000);
      const score = Number(body.score);
      if (!Number.isInteger(score) || score < 1 || score > 5) throw new HttpError(400, 'แตะดาวเพื่อให้คะแนนก่อนเน้อ', 'VALIDATION');
      const now = nowIso();
      const data = { bookingId: b.id, score, tags: (Array.isArray(body.tags) ? body.tags : []).slice(0, 8).map((t) => String(t).slice(0, 40)), comment: String(body.comment ?? '').slice(0, 2000), submittedAt: now };
      await env.DB.batch(writeStmts(env.DB, 'surveys', uuid(), data, now, null));
      ctx.waitUntil(notifyAll(env, [{ title: `รีวิวใหม่ ${'★'.repeat(score)}`, body: `${b.name}${data.comment ? ` · ${data.comment.slice(0, 80)}` : ''}`, url: '/customers', tag: 'survey' }]).catch(() => {}));
      return json({ ok: true });
    }
  }
  throw new HttpError(404, 'ไม่พบหน้า', 'NOT_FOUND');
}

async function createRequest(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const st = await getSettings(env.DB);
  if (!st.publicBooking) throw new HttpError(403, 'ตอนนี้ยังไม่เปิดรับจองออนไลน์ ติดต่อทาง LINE หรือโทรได้เลยเน้อ', 'CLOSED');
  const ip = clientIp(req);
  if (!(await rateLimit(env.DB, `req:${ip}`, env.DEV_MODE === '1' ? 1000 : 5, 3600))) throw new HttpError(429, 'ส่งคำขอบ่อยเกินไป ลองใหม่ในอีก 1 ชั่วโมง หรือทักทาง LINE ได้เลยเน้อ', 'RATE');
  const b = await readJson<Record<string, unknown>>(req, 20_000);
  if (b.website) return json({ ok: true }); // กับดักบอท (ช่องซ่อนที่คนไม่กรอก)
  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', String(b.turnstile ?? ''));
    form.append('remoteip', ip);
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const v = (await r.json()) as { success?: boolean };
    if (!v.success) throw new HttpError(400, 'ยืนยันว่าไม่ใช่บอทไม่สำเร็จ ลองกดส่งอีกครั้ง', 'TURNSTILE');
  }
  const name = String(b.name ?? '').trim().slice(0, 120);
  const phone = String(b.phone ?? '').replace(/[^\d+]/g, '').slice(0, 20);
  const checkIn = String(b.checkIn ?? '');
  const checkOut = String(b.checkOut ?? '');
  const adults = Math.floor(Number(b.adults) || 0);
  const children = Math.floor(Number(b.children) || 0);
  if (!name) throw new HttpError(400, 'ใส่ชื่อผู้จองก่อนเน้อ', 'VALIDATION');
  if (phone.replace(/\D/g, '').length < 9) throw new HttpError(400, 'ใส่เบอร์โทรให้ครบ เพื่อให้เราติดต่อกลับได้', 'VALIDATION');
  if (!DATE_RE.test(checkIn) || !DATE_RE.test(checkOut) || checkOut <= checkIn || checkIn < todayISO()) throw new HttpError(400, 'เลือกวันเข้าพักและวันออกใหม่อีกครั้ง', 'VALIDATION');
  if (adults < 1 || adults + children > 99 || children < 0) throw new HttpError(400, 'ใส่จำนวนผู้เข้าพักให้ถูกต้อง', 'VALIDATION');
  const c = await capacityCtx(env.DB, checkIn, checkOut);
  const free = Math.min(...daysInclusive(checkIn, addDays(checkOut, -1)).map((d) => dayFree(d, c)));
  if (adults + children > free) throw new HttpError(409, free > 0 ? `ช่วงนี้รับได้อีก ${free} คน ลองลดจำนวนคนหรือเลือกวันอื่นเน้อ` : 'ช่วงนี้เต็มแล้ว ลองเลือกวันอื่นเน้อ', 'FULL');
  const now = nowIso();
  const id = uuid();
  const data = { name, phone, lineId: String(b.lineId ?? '').slice(0, 60), checkIn, checkOut, adults, children, message: String(b.message ?? '').slice(0, 1000), status: 'new', bookingId: null, createdAt: now };
  await env.DB.batch(writeStmts(env.DB, 'requests', id, data, now, null));
  ctx.waitUntil(notifyAll(env, [{ title: 'คำขอจองออนไลน์ใหม่', body: `${name} · ${fmtRange(checkIn, checkOut)} · ${adults + children} คน · โทร ${phone}`, url: `/requests`, tag: 'request' }]).catch(() => {}));
  return json({ ok: true });
}
