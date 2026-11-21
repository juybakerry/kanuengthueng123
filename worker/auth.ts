/** เข้าสู่ระบบด้วยชื่อผู้ใช้ + รหัสผ่าน · จำการเข้าสู่ระบบ 180 วัน (cookie HttpOnly) · ไม่ใช้อีเมล */
import type { Env } from './env';
import { HttpError, clientIp, getCookie, json, nowIso, rateLimit, readJson } from './http';
import { hashPassword, randomToken, safeEqual, sha256Hex, uuid } from './crypto';
import type { UserInfo } from '../src/domain/types';

export const COOKIE = 'kt_sess';
const SESSION_DAYS = 180;

export interface Session {
  user: UserInfo;
  tokenHash: string;
  device: string;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  role: 'owner' | 'staff';
  pass_hash: string;
  pass_salt: string;
  disabled: number;
}

const toUser = (r: UserRow): UserInfo => ({ id: r.id, username: r.username, displayName: r.display_name, role: r.role });

function cookieHeader(env: Env, token: string, maxAge: number): string {
  const secure = env.DEV_MODE === '1' ? '' : '; Secure';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function getSession(req: Request, env: Env): Promise<Session | null> {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare(
    `SELECT s.token_hash, s.device, s.expires_at, s.last_seen, u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND u.disabled = 0`,
  )
    .bind(tokenHash)
    .first<UserRow & { device: string; expires_at: string; last_seen: string }>();
  if (!row || row.expires_at < nowIso()) return null;
  // ต่ออายุวันละครั้ง เพื่อให้ "จำการเข้าสู่ระบบ" ไปเรื่อย ๆ ตราบที่ยังใช้งาน
  if (Date.now() - Date.parse(row.last_seen) > 86400000) {
    const exp = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
    await env.DB.prepare('UPDATE sessions SET last_seen = ?, expires_at = ? WHERE token_hash = ?').bind(nowIso(), exp, tokenHash).run();
  }
  return { user: toUser(row), tokenHash, device: row.device ?? '' };
}

export async function requireSession(req: Request, env: Env): Promise<Session> {
  const s = await getSession(req, env);
  if (!s) throw new HttpError(401, 'กรุณาเข้าสู่ระบบอีกครั้ง', 'AUTH');
  return s;
}

export async function login(req: Request, env: Env): Promise<Response> {
  const body = await readJson<{ username?: string; password?: string; device?: string }>(req);
  const username = String(body.username ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const ip = clientIp(req);
  if (!(await rateLimit(env.DB, `login:${ip}`, 10, 900)) || !(await rateLimit(env.DB, `login-u:${username}`, 10, 900))) {
    throw new HttpError(429, 'ลองเข้าสู่ระบบหลายครั้งเกินไป รอ 15 นาทีแล้วลองใหม่', 'RATE');
  }
  const row = await env.DB.prepare('SELECT * FROM users WHERE username = ? AND disabled = 0').bind(username).first<UserRow>();
  if (!row) throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'LOGIN');
  const { hash } = await hashPassword(password, row.pass_salt);
  if (!safeEqual(hash, row.pass_hash)) throw new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'LOGIN');
  const token = randomToken(32);
  const now = nowIso();
  const device = String(body.device ?? '').slice(0, 60) || 'อุปกรณ์';
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, device, created_at, last_seen, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(await sha256Hex(token), row.id, device, now, now, new Date(Date.now() + SESSION_DAYS * 86400000).toISOString())
    .run();
  return json({ user: toUser(row) }, 200, { 'Set-Cookie': cookieHeader(env, token, SESSION_DAYS * 86400) });
}

export async function logout(req: Request, env: Env): Promise<Response> {
  const token = getCookie(req, COOKIE);
  if (token) {
    const h = await sha256Hex(token);
    await env.DB.batch([env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(h), env.DB.prepare('DELETE FROM push_subscriptions WHERE session_hash = ?').bind(h)]);
  }
  return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader(env, '', 0) });
}

const USERNAME_RE = /^[a-z0-9._-]{3,32}$/;

export async function createUser(env: Env, input: { username: string; displayName: string; password: string; role: 'owner' | 'staff' }): Promise<UserInfo> {
  const username = input.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'ชื่อผู้ใช้ใช้ได้เฉพาะ a–z 0–9 . _ - ยาว 3–32 ตัว', 'VALIDATION');
  if (input.password.length < 8) throw new HttpError(400, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว', 'VALIDATION');
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE username = ?').bind(username).first();
  if (exists) throw new HttpError(409, 'ชื่อผู้ใช้นี้มีแล้ว ใช้ชื่ออื่น', 'EXISTS');
  const { hash, salt } = await hashPassword(input.password);
  const id = uuid();
  const displayName = input.displayName.trim().slice(0, 40) || username;
  await env.DB.prepare('INSERT INTO users (id, username, display_name, role, pass_hash, pass_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(id, username, displayName, input.role, hash, salt, nowIso())
    .run();
  return { id, username, displayName, role: input.role };
}

export async function listUsers(env: Env): Promise<Array<UserInfo & { disabled: boolean; devices: number }>> {
  const { results } = await env.DB.prepare(
    `SELECT u.*, (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id) AS devices FROM users u ORDER BY u.created_at`,
  ).all<UserRow & { devices: number }>();
  return results.map((r) => ({ ...toUser(r), disabled: !!r.disabled, devices: r.devices }));
}

export async function usersRoute(req: Request, env: Env, s: Session, path: string): Promise<Response> {
  if (req.method === 'GET' && path === '/api/users') return json({ users: await listUsers(env) });
  if (req.method === 'POST' && path === '/api/users') {
    if (s.user.role !== 'owner') throw new HttpError(403, 'เฉพาะเจ้าของกิจการเพิ่มผู้ใช้ได้', 'FORBIDDEN');
    const b = await readJson<{ username: string; displayName: string; password: string; role: 'owner' | 'staff' }>(req);
    return json({ user: await createUser(env, { username: String(b.username ?? ''), displayName: String(b.displayName ?? ''), password: String(b.password ?? ''), role: b.role === 'owner' ? 'owner' : 'staff' }) });
  }
  const m = path.match(/^\/api\/users\/([\w-]+)\/(password|disable|enable)$/);
  if (req.method === 'POST' && m) {
    const [, id, action] = m;
    if (id !== s.user.id && s.user.role !== 'owner') throw new HttpError(403, 'เปลี่ยนได้เฉพาะรหัสผ่านของตัวเอง', 'FORBIDDEN');
    if (action === 'password') {
      const b = await readJson<{ password: string; current?: string }>(req);
      if (String(b.password ?? '').length < 8) throw new HttpError(400, 'รหัสผ่านต้องยาวอย่างน้อย 8 ตัว', 'VALIDATION');
      if (id === s.user.id) {
        const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
        const { hash } = await hashPassword(String(b.current ?? ''), row!.pass_salt);
        if (!safeEqual(hash, row!.pass_hash)) throw new HttpError(400, 'รหัสผ่านเดิมไม่ถูกต้อง', 'VALIDATION');
      }
      const { hash, salt } = await hashPassword(String(b.password));
      await env.DB.batch([
        env.DB.prepare('UPDATE users SET pass_hash = ?, pass_salt = ? WHERE id = ?').bind(hash, salt, id),
        // ออกจากระบบเครื่องอื่นทั้งหมดของผู้ใช้นี้ ยกเว้นเครื่องที่กำลังใช้
        env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').bind(id, s.tokenHash),
      ]);
      return json({ ok: true });
    }
    if (s.user.role !== 'owner' || id === s.user.id) throw new HttpError(403, 'ปิดบัญชีตัวเองไม่ได้', 'FORBIDDEN');
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(action === 'disable' ? 1 : 0, id),
      ...(action === 'disable' ? [env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id)] : []),
    ]);
    return json({ ok: true });
  }
  throw new HttpError(404, 'ไม่พบหน้า', 'NOT_FOUND');
}
