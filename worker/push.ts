/** แจ้งเตือน Web Push (VAPID) ฟรีไม่จำกัด · iPhone/iPad ต้องติดตั้งแอปลงหน้าจอก่อน (iOS 16.4+) */
import type { Env } from './env';
import type { Session } from './auth';
import { HttpError, json, nowIso, readJson } from './http';
import { sendPush } from './webpush';

export interface PushMsg {
  title: string;
  body: string;
  url: string;
  tag: string;
}

interface SubRow {
  endpoint: string;
  p256dh: string;
  auth: string;
  session_hash: string | null;
}

function vapid(env: Env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return { publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:admin@example.com' };
}

async function deliver(env: Env, subs: SubRow[], msgs: PushMsg[]): Promise<{ sent: number; failed: number }> {
  const v = vapid(env);
  if (!v || !subs.length) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  const gone: string[] = [];
  for (const sub of subs) {
    for (const m of msgs) {
      try {
        const status = await sendPush(sub, m, v, 6 * 3600);
        if (status === 404 || status === 410) {
          gone.push(sub.endpoint);
          break;
        }
        if (status >= 200 && status < 300) sent++;
        else failed++;
      } catch (e) {
        failed++;
        console.error('push send', e);
      }
    }
  }
  // ลบอุปกรณ์ที่ยกเลิกรับแจ้งเตือนแล้วอัตโนมัติ
  if (gone.length) await env.DB.batch(gone.map((e) => env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(e)));
  return { sent, failed };
}

/** ส่งให้ "อีกเครื่องหนึ่ง" (ไม่ส่งกลับเครื่องที่ทำรายการ) */
export async function notifyOthers(env: Env, sessionHash: string, msgs: PushMsg[]) {
  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE session_hash IS NULL OR session_hash <> ?').bind(sessionHash).all<SubRow>();
  return deliver(env, results, msgs.slice(0, 5));
}

export async function notifyAll(env: Env, msgs: PushMsg[]) {
  const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions').all<SubRow>();
  return deliver(env, results, msgs);
}

export async function pushRoute(req: Request, env: Env, s: Session, path: string): Promise<Response> {
  if (path === '/api/push/subscribe' && req.method === 'POST') {
    const b = await readJson<{ endpoint?: string; keys?: { p256dh?: string; auth?: string }; device?: string }>(req);
    const endpoint = String(b.endpoint ?? '');
    if (!/^https:\/\//.test(endpoint) || !b.keys?.p256dh || !b.keys?.auth) throw new HttpError(400, 'ข้อมูลการแจ้งเตือนไม่ครบ', 'VALIDATION');
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (endpoint, user_id, session_hash, p256dh, auth, device_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, session_hash = excluded.session_hash, p256dh = excluded.p256dh, auth = excluded.auth, device_label = excluded.device_label`,
    )
      .bind(endpoint, s.user.id, s.tokenHash, String(b.keys.p256dh), String(b.keys.auth), String(b.device ?? s.device).slice(0, 60), nowIso())
      .run();
    return json({ ok: true });
  }
  if (path === '/api/push/unsubscribe' && req.method === 'POST') {
    const b = await readJson<{ endpoint?: string }>(req);
    await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(String(b.endpoint ?? '')).run();
    return json({ ok: true });
  }
  if (path === '/api/push/test' && req.method === 'POST') {
    const { results } = await env.DB.prepare('SELECT * FROM push_subscriptions WHERE session_hash = ?').bind(s.tokenHash).all<SubRow>();
    if (!vapid(env)) throw new HttpError(503, 'ยังไม่ได้ตั้งค่าคีย์แจ้งเตือนบนเซิร์ฟเวอร์', 'NO_VAPID');
    if (!results.length) throw new HttpError(400, 'เครื่องนี้ยังไม่ได้เปิดการแจ้งเตือน', 'NO_SUB');
    const r = await deliver(env, results, [{ title: 'ทดสอบการแจ้งเตือน', body: 'เครื่องนี้รับแจ้งเตือนจากคะนึงถึงได้แล้ว', url: '/today', tag: 'test' }]);
    return json(r);
  }
  if (path === '/api/push/devices' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT p.device_label, p.created_at, u.display_name FROM push_subscriptions p LEFT JOIN users u ON u.id = p.user_id ORDER BY p.created_at').all();
    return json({ devices: results });
  }
  throw new HttpError(404, 'ไม่พบหน้า', 'NOT_FOUND');
}
