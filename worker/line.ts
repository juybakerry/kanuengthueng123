/**
 * LINE Official Account (ไม่บังคับ) — LINE Notify ปิดบริการแล้ว จึงใช้ Messaging API แผนฟรี (300 ข้อความ/เดือน)
 * ใช้เฉพาะสรุปรายวันให้พนักงาน · ลงทะเบียนโดยพิมพ์ "ลงทะเบียน <รหัส 6 หลักจากหน้าตั้งค่า>" ในแชท OA
 */
import type { Env } from './env';
import type { Session } from './auth';
import { HttpError, json, nowIso } from './http';
import { loadDataset } from './records';
import { tomorrowDigest, digestText } from './digest';
import { todayISO } from '../src/domain/dates';

const enc = new TextEncoder();
const configured = (env: Env) => !!(env.LINE_CHANNEL_SECRET?.trim() && env.LINE_CHANNEL_ACCESS_TOKEN?.trim());

async function getMeta(db: D1Database, key: string): Promise<string | null> {
  return (await db.prepare('SELECT value FROM meta WHERE key = ?').bind(key).first<{ value: string }>())?.value ?? null;
}
const setMeta = (db: D1Database, key: string, value: string) => db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();

export async function lineRecipients(db: D1Database): Promise<string[]> {
  try {
    return JSON.parse((await getMeta(db, 'line_to')) ?? '[]');
  } catch {
    return [];
  }
}

async function lineApi(env: Env, path: string, body: unknown): Promise<Response> {
  return fetch(`https://api.line.me/v2/bot/message/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN!.trim()}` },
    body: JSON.stringify(body),
  });
}

const reply = (env: Env, token: string, text: string) => lineApi(env, 'reply', { replyToken: token, messages: [{ type: 'text', text: text.slice(0, 4900) }] });

export async function linePush(env: Env, text: string): Promise<number> {
  if (!configured(env)) return 0;
  const to = await lineRecipients(env.DB);
  let n = 0;
  for (const t of to) {
    const r = await lineApi(env, 'push', { to: t, messages: [{ type: 'text', text: text.slice(0, 4900) }] });
    if (r.ok) n++;
    else console.error('line push', r.status, await r.text());
  }
  return n;
}

export async function lineWebhook(req: Request, env: Env): Promise<Response> {
  if (!configured(env)) return new Response('LINE not configured', { status: 503 });
  const body = await req.text();
  const key = await crypto.subtle.importKey('raw', enc.encode(env.LINE_CHANNEL_SECRET!.trim()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(body)));
  const expected = btoa(String.fromCharCode(...sig));
  if ((req.headers.get('x-line-signature') ?? '') !== expected) return new Response('bad signature', { status: 401 });
  const data = JSON.parse(body) as { events?: Array<{ type: string; replyToken?: string; source?: { userId?: string; groupId?: string; roomId?: string }; message?: { type: string; text?: string } }> };
  for (const ev of data.events ?? []) {
    if (ev.type !== 'message' || ev.message?.type !== 'text' || !ev.replyToken) continue;
    const text = (ev.message.text ?? '').trim();
    const chat = ev.source?.groupId ?? ev.source?.roomId ?? ev.source?.userId ?? '';
    const m = text.match(/^ลงทะเบียน\s*(\d{6})$/);
    if (m) {
      const code = await getMeta(env.DB, 'line_code');
      const [c, exp] = (code ?? '').split('|');
      if (!c || c !== m[1] || Number(exp) < Date.now()) {
        await reply(env, ev.replyToken, 'รหัสไม่ถูกต้องหรือหมดอายุ ขอรหัสใหม่ในแอป: ตั้งค่า › การแจ้งเตือน › LINE');
        continue;
      }
      const to = await lineRecipients(env.DB);
      if (!to.includes(chat)) to.push(chat);
      await setMeta(env.DB, 'line_to', JSON.stringify(to.slice(0, 5)));
      await setMeta(env.DB, 'line_code', '');
      await reply(env, ev.replyToken, 'ลงทะเบียนเรียบร้อย แชทนี้จะได้รับสรุปแขกเข้าพักพรุ่งนี้ทุกเย็น\nพิมพ์ "พรุ่งนี้" เพื่อดูสรุปได้ทุกเมื่อ · "ยกเลิกแจ้งเตือน" เพื่อหยุดรับ');
      continue;
    }
    const to = await lineRecipients(env.DB);
    if (!to.includes(chat)) continue; // ไม่ตอบแชทลูกค้า ใช้คุยกับลูกค้าตามปกติได้
    if (text === 'ยกเลิกแจ้งเตือน') {
      await setMeta(env.DB, 'line_to', JSON.stringify(to.filter((x) => x !== chat)));
      await reply(env, ev.replyToken, 'หยุดส่งสรุปเข้าแชทนี้แล้ว');
    } else if (text === 'พรุ่งนี้' || text === 'สรุป') {
      const d = tomorrowDigest(await loadDataset(env.DB), todayISO());
      await reply(env, ev.replyToken, d ? digestText(d) : 'พรุ่งนี้ยังไม่มีแขกเข้าพักหรือเช็คเอาท์');
    }
  }
  return json({ ok: true });
}

export async function lineRoute(req: Request, env: Env, _s: Session, path: string): Promise<Response> {
  if (path === '/api/line/status' && req.method === 'GET') {
    const to = await lineRecipients(env.DB);
    return json({ configured: configured(env), recipients: to.length, webhook: `${new URL(req.url).origin}/api/line/webhook` });
  }
  if (path === '/api/line/code' && req.method === 'POST') {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(6, '0');
    await setMeta(env.DB, 'line_code', `${code}|${Date.now() + 30 * 60_000}`);
    return json({ code, expiresInMin: 30 });
  }
  if (path === '/api/line/test' && req.method === 'POST') {
    if (!configured(env)) throw new HttpError(503, 'ยังไม่ได้ใส่คีย์ LINE บนเซิร์ฟเวอร์', 'NO_LINE');
    const n = await linePush(env, `ทดสอบจากแอปคะนึงถึง ${nowIso().slice(11, 16)} UTC`);
    if (!n) throw new HttpError(400, 'ยังไม่มีแชทที่ลงทะเบียนรับแจ้งเตือน', 'NO_RECIPIENT');
    return json({ sent: n });
  }
  if (path === '/api/line/clear' && req.method === 'POST') {
    await setMeta(env.DB, 'line_to', '[]');
    return json({ ok: true });
  }
  throw new HttpError(404, 'ไม่พบหน้า', 'NOT_FOUND');
}
