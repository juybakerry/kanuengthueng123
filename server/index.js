// Kanuengthueng Homestay server: shared data for both devices, the public booking/review/payment pages,
// photo uploads, LINE notifications and daily backups.
//
//   node server/index.js          serve the built app from dist/
//   node server/index.js --dev    serve the source through Vite with hot reload
//
// Data goes to PostgreSQL when DATABASE_URL is set, otherwise to the data/ folder.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createStore, emptyData } from './store.js';
import { createPersistence } from './persist.js';
import { pushLine, replyLine, lineReady, webhookReady, envTargets, validSignature } from './line.js';
import { seedData } from '../src/lib/seed.js';
import { add, diff, fD, fDY, gOf, baht, nowText, nightsOf, occupancy, spotsLeft, calcTotal, paidOf, CAP } from '../src/lib/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV = process.argv.includes('--dev');
const PORT = +process.env.PORT || (DEV ? 5173 : 8787);
const DATA_DIR = path.resolve(ROOT, process.env.DATA_DIR || 'data');
const PIN = process.env.ADMIN_PIN || '';
const MAX_UPLOAD = 15 * 1024 * 1024;
// Behind a hosting proxy (Render etc.) the visitor's address is in X-Forwarded-For.
const BEHIND_PROXY = !!(process.env.RENDER || process.env.TRUST_PROXY);
// Public address, used in LINE messages (Render sets RENDER_EXTERNAL_URL automatically).
const PUBLIC_URL = (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '');

const persist = createPersistence({ dataDir: DATA_DIR, databaseUrl: process.env.DATABASE_URL });
let store;
try {
  store = await createStore(persist);
} catch (e) {
  console.error(`เชื่อมต่อฐานข้อมูลไม่ได้ (${persist.label}): ${e.message}`);
  process.exit(1);
}

// LINE recipients: LINE_TO plus chats registered from LINE with "ลงทะเบียน <PIN>".
const lineTargets = () => [...new Set([...envTargets(), ...(store.get().meta.lineTargets || [])])];
const notify = text => pushLine(lineTargets(), text);

// ─── helpers ──────────────────────────────────────────────────────────────────
const pad2 = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
const hhmm = () => { const d = new Date(); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const str = (v, max) => String(v ?? '').trim().slice(0, max);

function send(res, code, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  res.writeHead(code, { 'Content-Type': isBuf ? 'application/octet-stream' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(isBuf ? body : JSON.stringify(body));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
const readJson = async (req, limit = 2 * 1024 * 1024) => {
  const b = await readBody(req, limit);
  try { return JSON.parse(b.toString('utf8') || '{}'); } catch { throw Object.assign(new Error('bad json'), { status: 400 }); }
};

function isAdmin(req, url) {
  if (!PIN) return true;
  const got = req.headers['x-admin-pin'] || url.searchParams.get('pin') || '';
  const a = Buffer.from(String(got)), b = Buffer.from(PIN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Public forms: at most 8 submissions per IP per hour.
const hits = new Map();
function clientIp(req) {
  const fwd = BEHIND_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || '?';
}
function limited(req) {
  const ip = clientIp(req), now = Date.now();
  const list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  list.push(now);
  hits.set(ip, list);
  return list.length > 8;
}

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${PORT}`);
  }
  return out;
}

const roomsText = (S, b) => Object.keys(b.rooms || {}).sort().map(r => {
  const room = S.rooms.find(x => x.id === r);
  return (room ? room.name : r).replace('ห้องที่ ', 'ห้อง ') + ` (${b.rooms[r]})`;
}).join(', ');

// ─── LINE triggers ────────────────────────────────────────────────────────────
store.onChange((before, after, ops) => {
  const S = after.settings;
  for (const op of ops) {
    if (op.c === 'bookings' && op.op === 'put' && !before.bookings.some(b => b.id === op.rec.id) && S.line.newBooking) {
      const b = op.rec;
      notify(`🆕 การจองใหม่ ${b.id}\n${b.name} · ${gOf(b)} คน\n${fD(b.checkIn)} – ${fDY(b.checkOut)} (${diff(b.checkIn, b.checkOut)} คืน)\n${roomsText(S, b)}\nยอด ${baht(b.total)} บาท · ช่องทาง ${b.channel}`);
    }
  }
});

// ─── daily jobs ───────────────────────────────────────────────────────────────
async function backupNow(reason) {
  const d = store.get(), day = today();
  await persist.backup(day, d, 30);
  store.update(x => ({ ...x, settings: { ...x.settings, lastBackup: nowText() }, meta: { ...x.meta, lastBackupDay: day } }));
  console.log(`[backup] ${reason} · ${day}`);
}

function summaryText(d) {
  const S = d.settings, t = today(), tom = add(t, 1);
  const B = d.bookings.filter(b => !b.cancelled);
  const parts = [];
  if (S.line.tomorrow) {
    const arr = B.filter(b => b.checkIn === tom);
    parts.push(`📅 พรุ่งนี้ ${fDY(tom)} เช็คอิน ${arr.length} กลุ่ม ${arr.reduce((a, b) => a + gOf(b), 0)} คน`);
    for (const b of arr) {
      parts.push(`• ${b.name} ${gOf(b)} คน · ${roomsText(S, b)}${b.transfer ? ` · รถ ${b.pickupTime} ${b.pickupPlace}` : ''}${b.allergy ? ` · ⚠ ${b.allergy}` : ''}${b.total - paidOf(b) > 0 ? ` · เก็บเพิ่ม ${baht(b.total - paidOf(b))}` : ''}`);
    }
  }
  if (S.line.due) {
    const due = B.filter(b => b.status === 'unpaid' && add(b.createdAt, S.depositDays) <= tom);
    if (due.length) {
      parts.push('', `💰 มัดจำครบกำหนด / เลยกำหนด ${due.length} รายการ`);
      for (const b of due) parts.push(`• ${b.name} ${baht(b.total / 2)} บาท · ครบกำหนด ${fD(add(b.createdAt, S.depositDays))}`);
    }
  }
  if (S.line.requests && d.requests.length) parts.push('', `📨 คำขอจองออนไลน์รอยืนยัน ${d.requests.length} รายการ`);
  return parts.join('\n');
}

let backingUp = false;
setInterval(() => {
  const d = store.get(), day = today(), now = hhmm();
  if (d.settings.backupAuto && now >= '03:00' && d.meta.lastBackupDay !== day && !backingUp) {
    backingUp = true;
    backupNow('daily').catch(e => console.error('[backup] failed:', e.message)).finally(() => { backingUp = false; });
  }
  if (now >= (d.settings.summaryTime || '18:00') && d.meta.lastSummaryDay !== day) {
    store.update(x => ({ ...x, meta: { ...x.meta, lastSummaryDay: day } }));
    const text = summaryText(store.get());
    if (text.trim()) notify(text);
  }
}, 30e3).unref();
setInterval(() => store.ping(), 25e3).unref();

// ─── public API (customers) ───────────────────────────────────────────────────
function publicInfo() {
  const d = store.get(), S = d.settings, t = today(), occ = occupancy(d.bookings);
  const days = {};
  for (let i = 0; i < 180; i++) { const x = add(t, i); days[x] = spotsLeft(S, d.closures, occ, x); }
  return {
    today: t, cap: S.rooms.reduce((a, r) => a + r.cap, 0), days,
    price: S.price, special: S.special, group: S.group, checkInTime: S.checkInTime, checkOutTime: S.checkOutTime, depositDays: S.depositDays,
  };
}

function createRequest(body) {
  const d = store.get(), S = d.settings, t = today();
  const r = {
    name: str(body.name, 100), phone: str(body.phone, 30), line: str(body.line, 60),
    checkIn: body.checkIn, checkOut: body.checkOut, adults: Math.floor(+body.adults || 0), children: Math.floor(+body.children || 0),
    transfer: !!body.transfer, pickupPlace: str(body.pickupPlace, 120), pickupTime: str(body.pickupTime, 5),
    allergy: str(body.allergy, 300), note: str(body.note, 500),
  };
  if (!r.name) return { error: 'กรุณากรอกชื่อ' };
  if (!/[0-9]{9,}/.test(r.phone.replace(/\D/g, ''))) return { error: 'กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง' };
  if (!isDate(r.checkIn) || !isDate(r.checkOut) || r.checkIn >= r.checkOut) return { error: 'วันออกต้องอยู่หลังวันเข้าพัก' };
  if (r.checkIn < t) return { error: 'วันเข้าพักต้องไม่ใช่วันที่ผ่านมาแล้ว' };
  if (diff(r.checkIn, r.checkOut) > 30) return { error: 'จองได้ไม่เกิน 30 คืนต่อครั้ง' };
  const g = r.adults + r.children;
  if (r.adults < 1 || g > CAP) return { error: `จำนวนผู้เข้าพัก 1–${CAP} คน (ผู้ใหญ่อย่างน้อย 1 คน)` };
  const occ = occupancy(d.bookings);
  for (const n of nightsOf(r)) if (spotsLeft(S, d.closures, occ, n) < g) return { error: `คืนวันที่ ${fD(n)} ที่พักว่างไม่พอสำหรับ ${g} คน` };
  const est = calcTotal(r.checkIn, r.checkOut, g, S).total;
  const id = 'RQ-' + Date.now().toString(36).toUpperCase();
  const rec = { id, ...r, estimate: est, createdAt: t, createdText: nowText() };
  store.apply([{ c: 'requests', op: 'put', rec }, { c: 'audit', op: 'add', rec: { t: nowText(), device: 'หน้าจองออนไลน์', action: 'คำขอจองออนไลน์', detail: `${id} ${r.name} · ${fD(r.checkIn)} · ${g} คน` } }]);
  if (S.line.requests) notify(`📨 คำขอจองออนไลน์\n${r.name} · ${r.phone}${r.line ? ' · LINE ' + r.line : ''}\n${fD(r.checkIn)} – ${fDY(r.checkOut)} · ${g} คน\nประมาณ ${baht(est)} บาท\nเปิดแอปเพื่อยืนยันการจอง`);
  return { ok: true, id, estimate: est };
}

function publicBooking(token) {
  const d = store.get(), b = token && d.bookings.find(x => x.token === token);
  if (!b) return null;
  const paid = paidOf(b), S = d.settings;
  return {
    id: b.id, name: b.name, checkIn: b.checkIn, checkOut: b.checkOut, guests: gOf(b), rooms: roomsText(S, b),
    total: b.total, paid, due: b.cancelled ? 0 : b.total - paid, status: b.status, cancelled: !!b.cancelled,
    depositDue: add(b.createdAt, S.depositDays), promptpay: S.promptpay, promptpayName: S.promptpayName,
    checkInTime: S.checkInTime, checkOutTime: S.checkOutTime, reviewed: d.reviews.some(r => r.bookingId === b.id),
  };
}

function createReview(body) {
  const rating = Math.round(+body.rating);
  if (!(rating >= 1 && rating <= 5)) return { error: 'กรุณาให้คะแนน 1–5 ดาว' };
  const d = store.get(), b = body.token && d.bookings.find(x => x.token === body.token);
  const rec = {
    id: 'RV-' + Date.now().toString(36).toUpperCase(), rating, comment: str(body.comment, 1000),
    name: b ? b.name : str(body.name, 100) || 'ไม่ระบุชื่อ', bookingId: b ? b.id : '', date: today(),
  };
  store.apply([{ c: 'reviews', op: 'put', rec }]);
  notify(`⭐ รีวิวใหม่ ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}\n${rec.name}${rec.comment ? '\n“' + rec.comment + '”' : ''}`);
  return { ok: true };
}

// ─── LINE webhook ─────────────────────────────────────────────────────────────
// In a chat with the Official Account (or a group it was added to):
//   "ลงทะเบียน <PIN>"  start receiving notifications in this chat
//   "ยกเลิกแจ้งเตือน"   stop
//   "id"               show this chat's id
// Other messages are left alone so the OA can still be used to talk with customers.
async function lineWebhook(req, res) {
  const raw = await readBody(req, 1024 * 1024);
  if (!validSignature(raw, req.headers['x-line-signature'])) return send(res, 401, { error: 'bad signature' });
  let body;
  try { body = JSON.parse(raw.toString('utf8')); } catch { return send(res, 400, { error: 'bad json' }); }
  send(res, 200, { ok: true });
  for (const ev of body.events || []) await handleLineEvent(ev).catch(e => console.error('[LINE] webhook event failed', e.message));
}

async function handleLineEvent(ev) {
  const src = ev.source || {}, chat = src.groupId || src.roomId || src.userId, tok = ev.replyToken;
  if (!chat || !tok) return;
  const targets = store.get().meta.lineTargets || [];
  const registered = targets.includes(chat) || envTargets().includes(chat);
  if (ev.type === 'join') {
    return replyLine(tok, 'สวัสดีค่ะ ระบบคะนึงถึงโฮมสเตย์\nพิมพ์ "ลงทะเบียน <รหัส PIN>" เพื่อให้กลุ่มนี้รับแจ้งเตือนการจอง');
  }
  if (ev.type !== 'message' || !ev.message || ev.message.type !== 'text') return;
  const text = ev.message.text.trim();
  const reg = text.match(/^(?:ลงทะเบียน|register)\s*(\S*)$/i);
  if (reg) {
    if (registered) return replyLine(tok, 'แชทนี้รับแจ้งเตือนอยู่แล้ว');
    // Without a PIN only the very first chat may register (the owner doing setup).
    if (PIN ? reg[1] !== PIN : lineTargets().length > 0) return replyLine(tok, PIN ? 'รหัส PIN ไม่ถูกต้อง' : 'ตั้ง ADMIN_PIN บนเซิร์ฟเวอร์ก่อน จึงจะเพิ่มผู้รับแจ้งเตือนได้');
    store.update(x => ({ ...x, meta: { ...x.meta, lineTargets: [...(x.meta.lineTargets || []), chat] } }));
    console.log('[LINE] registered', chat);
    return replyLine(tok, '✅ ลงทะเบียนแล้ว แชทนี้จะได้รับแจ้งเตือนการจองใหม่ คำขอจองออนไลน์ รีวิว และสรุปประจำวัน\nพิมพ์ "ยกเลิกแจ้งเตือน" เพื่อหยุด');
  }
  if (/^(?:ยกเลิกแจ้งเตือน|unregister)$/i.test(text)) {
    if (!targets.includes(chat)) return replyLine(tok, envTargets().includes(chat) ? 'แชทนี้ตั้งไว้ใน LINE_TO บนเซิร์ฟเวอร์ ต้องลบที่นั่น' : 'แชทนี้ไม่ได้รับแจ้งเตือนอยู่แล้ว');
    store.update(x => ({ ...x, meta: { ...x.meta, lineTargets: (x.meta.lineTargets || []).filter(t => t !== chat) } }));
    return replyLine(tok, 'หยุดส่งแจ้งเตือนมาที่แชทนี้แล้ว');
  }
  if (/^(?:id|ไอดี)$/i.test(text)) return replyLine(tok, `ID ของแชทนี้: ${chat}${registered ? '\n(รับแจ้งเตือนอยู่)' : ''}`);
  return undefined;
}

// ─── routes ───────────────────────────────────────────────────────────────────
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function serveFile(res, file, cache) {
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache });
    fs.createReadStream(file).pipe(res);
  });
}
const inside = (base, p) => { const f = path.resolve(base, '.' + path.sep + p); return f.startsWith(base + path.sep) ? f : null; };

async function api(req, res, url) {
  const p = url.pathname, m = req.method;

  // public
  if (p === '/api/health') return send(res, 200, { ok: true });
  if (p === '/api/public/info' && m === 'GET') return send(res, 200, publicInfo());
  if (p === '/api/public/request' && m === 'POST') {
    if (limited(req)) return send(res, 429, { error: 'ส่งคำขอบ่อยเกินไป กรุณาลองใหม่ภายหลังหรือติดต่อทางโทรศัพท์' });
    const r = createRequest(await readJson(req, 20e3));
    return send(res, r.error ? 400 : 200, r);
  }
  if (p.startsWith('/api/public/booking/') && m === 'GET') {
    const b = publicBooking(decodeURIComponent(p.slice(20)));
    return b ? send(res, 200, b) : send(res, 404, { error: 'ไม่พบการจอง' });
  }
  if (p === '/api/public/review' && m === 'POST') {
    if (limited(req)) return send(res, 429, { error: 'ส่งบ่อยเกินไป กรุณาลองใหม่ภายหลัง' });
    const r = createReview(await readJson(req, 20e3));
    return send(res, r.error ? 400 : 200, r);
  }

  if (p === '/api/line/webhook' && m === 'POST') return lineWebhook(req, res);

  // owner/staff
  if (!isAdmin(req, url)) return send(res, 401, { error: 'ต้องใส่รหัส PIN' });
  if (p === '/api/state' && m === 'GET') {
    const { meta, ...data } = store.get();
    return send(res, 200, data);
  }
  if (p === '/api/events' && m === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write(`event: rev\ndata: ${JSON.stringify({ rev: store.get().rev })}\n\n`);
    return store.subscribe(res);
  }
  if (p === '/api/ops' && m === 'POST') {
    const body = await readJson(req, 20 * 1024 * 1024);
    if (!Array.isArray(body.ops)) return send(res, 400, { error: 'ops required' });
    return send(res, 200, store.apply(body.ops));
  }
  if (p === '/api/reset' && m === 'POST') {
    const { mode } = await readJson(req);
    await backupNow('before reset');
    store.replace(mode === 'empty' ? emptyData() : seedData());
    return send(res, 200, { ok: true, rev: store.get().rev });
  }
  if (p === '/api/backup' && m === 'POST') { await backupNow('manual'); return send(res, 200, { ok: true }); }
  if (p === '/api/info' && m === 'GET') {
    return send(res, 200, {
      lan: PUBLIC_URL ? [] : lanUrls(), publicUrl: PUBLIC_URL, line: lineReady(), lineWebhook: webhookReady(),
      lineTargets: lineTargets().length, webhookUrl: (PUBLIC_URL || `http://localhost:${PORT}`) + '/api/line/webhook',
      pin: !!PIN, storage: persist.kind, dataFile: persist.label,
    });
  }
  if (p === '/api/line/test' && m === 'POST') return send(res, 200, await notify('✅ ทดสอบการแจ้งเตือนจากระบบคะนึงถึงโฮมสเตย์'));
  if (p === '/api/line/summary' && m === 'POST') {
    const text = summaryText(store.get());
    return send(res, 200, text.trim() ? await notify(text) : { ok: false, reason: 'empty' });
  }
  if (p === '/api/upload' && m === 'POST') {
    const type = String(req.headers['content-type'] || '').split(';')[0];
    const ext = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/heic': '.heic' }[type];
    if (!ext) return send(res, 415, { error: 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WebP, GIF, HEIC)' });
    const buf = await readBody(req, MAX_UPLOAD);
    const id = Date.now().toString(36) + '-' + crypto.randomBytes(6).toString('hex') + ext;
    await persist.putFile(id, type, buf);
    return send(res, 200, { name: str(url.searchParams.get('name') || id, 120), url: '/uploads/' + id });
  }
  return send(res, 404, { error: 'not found' });
}

const server = http.createServer();
let vite = null;
if (DEV) {
  const { createServer } = await import('vite');
  vite = await createServer({ root: ROOT, server: { middlewareMode: true, ws: { server } }, appType: 'spa' });
}
const DIST = path.join(ROOT, 'dist');

server.on('request', async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (url.pathname.startsWith('/uploads/')) {
      if (!isAdmin(req, url)) return send(res, 401, { error: 'ต้องใส่รหัส PIN' });
      const id = url.pathname.slice(9);
      const f = /^[\w.-]+$/.test(id) ? await persist.getFile(id) : null;
      if (!f) return send(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': f.type, 'Content-Length': f.buf.length, 'Cache-Control': 'private, max-age=86400' });
      return res.end(f.buf);
    }
    if (vite) return vite.middlewares(req, res, () => send(res, 404, { error: 'not found' }));
    const f = url.pathname !== '/' && inside(DIST, decodeURIComponent(url.pathname));
    if (f && fs.existsSync(f) && fs.statSync(f).isFile()) return serveFile(res, f, url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    return serveFile(res, path.join(DIST, 'index.html'), 'no-cache');
  } catch (e) {
    if (!res.headersSent) send(res, e.status || 500, { error: e.status ? e.message : 'server error' });
    if (!e.status) console.error(e);
  }
});

if (!DEV && !fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('ยังไม่มีโฟลเดอร์ dist/ — รัน "npm run build" ก่อน หรือใช้ "npm run dev"');
  process.exit(1);
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\nคะนึงถึงโฮมสเตย์ ${DEV ? '(dev)' : ''}`);
  console.log(`  เครื่องนี้:      http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`  เครื่องอื่นใน Wi-Fi: ${u}`);
  if (PUBLIC_URL) console.log(`  ที่อยู่สาธารณะ:  ${PUBLIC_URL}`);
  console.log(`  ข้อมูล:         ${persist.label}`);
  console.log(`  LINE:           ${lineReady() ? `พร้อมใช้งาน · ผู้รับ ${lineTargets().length} แชท${webhookReady() ? '' : ' · ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET'}` : 'ยังไม่ได้ตั้งค่า (ดู .env.example)'}`);
  console.log(`  PIN:            ${PIN ? 'เปิดใช้งาน' : 'ไม่ได้ตั้ง (ใครในวง Wi-Fi ก็เข้าได้)'}\n`);
});

const stop = async () => {
  try { await store.saveNow(); await persist.close(); } finally { process.exit(0); }
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
