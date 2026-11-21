/**
 * คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์ — Cloudflare Worker ตัวเดียว: เสิร์ฟแอป (PWA) + API + งานตั้งเวลา
 * ฟรีทั้งหมด (Workers Free + D1 Free) ไม่หลับเหมือนโฮสต์ฟรีทั่วไป
 */
import type { Env } from './env';
import { HttpError, clientIp, errorResponse, json, nowIso, rateLimit, readJson } from './http';
import { createUser, getSession, login, logout, requireSession, usersRoute } from './auth';
import { mutateRoute, syncRoute } from './sync';
import { getFile, uploadFile } from './files';
import { pushRoute } from './push';
import { lineRoute, lineWebhook } from './line';
import { backupRoute, runBackup } from './backup';
import { publicRoute } from './public';
import { runCron } from './cron';
import { ensureSeed } from './records';
import { safeEqual } from './crypto';

let seeded = false;

async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith('/api/')) return env.ASSETS.fetch(req);

  // กัน CSRF: คำขอที่เปลี่ยนข้อมูลต้องมาจากหน้าเว็บของเราเอง (ยกเว้น webhook / public / admin)
  if (req.method !== 'GET' && req.method !== 'HEAD' && !path.startsWith('/api/line/webhook') && !path.startsWith('/api/admin/')) {
    const origin = req.headers.get('origin');
    const devOk = env.DEV_MODE === '1' && !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    if (origin && origin !== url.origin && !devOk) throw new HttpError(403, 'คำขอไม่ได้มาจากแอป', 'ORIGIN');
  }
  if (!seeded) {
    await ensureSeed(env);
    seeded = true;
  }

  if (path === '/api/health') {
    const r = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'seq'`).first<{ value: string }>();
    return json({ ok: true, seq: Number(r?.value ?? 0), time: nowIso(), push: !!env.VAPID_PUBLIC_KEY, line: !!env.LINE_CHANNEL_ACCESS_TOKEN });
  }
  if (path === '/api/login' && req.method === 'POST') return login(req, env);
  if (path === '/api/logout' && req.method === 'POST') return logout(req, env);
  if (path === '/api/line/webhook' && req.method === 'POST') return lineWebhook(req, env);
  if (path.startsWith('/api/public/')) return publicRoute(req, env, path, ctx);
  if (path === '/api/client-error' && req.method === 'POST') {
    if (await rateLimit(env.DB, `err:${clientIp(req)}`, 30, 3600)) {
      const b = await readJson<{ message?: string; detail?: string; url?: string }>(req, 20_000);
      await env.DB.prepare('INSERT INTO client_errors (at, message, detail, url, ua) VALUES (?, ?, ?, ?, ?)')
        .bind(nowIso(), String(b.message ?? '').slice(0, 500), String(b.detail ?? '').slice(0, 4000), String(b.url ?? '').slice(0, 300), (req.headers.get('user-agent') ?? '').slice(0, 300))
        .run();
    }
    return json({ ok: true });
  }
  if (path.startsWith('/api/admin/')) return adminRoute(req, env, path);

  if (path === '/api/me' && req.method === 'GET') {
    const s = await getSession(req, env);
    return json({ user: s?.user ?? null, device: s?.device ?? null, vapidPublicKey: env.VAPID_PUBLIC_KEY ?? '', now: nowIso() });
  }

  const s = await requireSession(req, env);
  if (path === '/api/sync' && req.method === 'GET') return syncRoute(req, env);
  if (path === '/api/mutate' && req.method === 'POST') return mutateRoute(req, env, s, ctx);
  if (path === '/api/files' && req.method === 'POST') return uploadFile(req, env, s);
  const f = path.match(/^\/api\/files\/([\w-]{8,64})$/);
  if (f && req.method === 'GET') return getFile(env, f[1]!);
  if (path.startsWith('/api/users')) return usersRoute(req, env, s, path);
  if (path.startsWith('/api/push/')) return pushRoute(req, env, s, path);
  if (path.startsWith('/api/line/')) return lineRoute(req, env, s, path);
  if (path === '/api/export.json' || path.startsWith('/api/backups') || path === '/api/restore') return backupRoute(req, env, s, path);
  throw new HttpError(404, 'ไม่พบหน้า', 'NOT_FOUND');
}

/** สคริปต์ดูแลระบบ (ต้องมี ADMIN_TOKEN): สร้างผู้ใช้ครั้งแรก สำรองข้อมูล ทดสอบ cron */
async function adminRoute(req: Request, env: Env, path: string): Promise<Response> {
  const auth = req.headers.get('authorization') ?? '';
  if (!env.ADMIN_TOKEN || !safeEqual(auth, `Bearer ${env.ADMIN_TOKEN}`)) throw new HttpError(401, 'unauthorized', 'AUTH');
  if (path === '/api/admin/users' && req.method === 'POST') {
    const b = await readJson<{ username: string; displayName: string; password: string; role: 'owner' | 'staff' }>(req);
    return json({ user: await createUser(env, b) });
  }
  if (path === '/api/admin/backup' && req.method === 'POST') return json(await runBackup(env));
  if (path === '/api/admin/cron' && req.method === 'POST') {
    const at = new URL(req.url).searchParams.get('at');
    await runCron(env, at ? new Date(at) : new Date());
    return json({ ok: true });
  }
  if (path === '/api/admin/errors' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT * FROM client_errors ORDER BY id DESC LIMIT 50').all();
    return json({ errors: results });
  }
  throw new HttpError(404, 'not found', 'NOT_FOUND');
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      return await handle(req, env, ctx);
    } catch (e) {
      return errorResponse(e);
    }
  },
  async scheduled(_ev: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runCron(env));
  },
} satisfies ExportedHandler<Env>;
