/** ตัวช่วย HTTP: ตอบ JSON, อ่าน cookie, ข้อผิดพลาดที่ผู้ใช้อ่านเข้าใจ */

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
  ) {
    super(message);
  }
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers },
  });
}

export function errorResponse(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
  console.error('unhandled', e instanceof Error ? e.stack : e);
  return json({ error: 'ระบบขัดข้องชั่วคราว ลองใหม่อีกครั้ง', code: 'INTERNAL' }, 500);
}

export async function readJson<T = Record<string, unknown>>(req: Request, maxBytes = 512_000): Promise<T> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > maxBytes) throw new HttpError(413, 'ข้อมูลใหญ่เกินไป', 'TOO_LARGE');
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, 'ข้อมูลใหญ่เกินไป', 'TOO_LARGE');
  try {
    return JSON.parse(text || '{}') as T;
  } catch {
    throw new HttpError(400, 'รูปแบบข้อมูลไม่ถูกต้อง', 'BAD_JSON');
  }
}

export function getCookie(req: Request, name: string): string | null {
  const c = req.headers.get('cookie') ?? '';
  for (const part of c.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function clientIp(req: Request): string {
  return req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export const nowIso = () => new Date().toISOString();

/** จำกัดจำนวนครั้งต่อช่วงเวลา (เก็บใน D1) คืน false ถ้าเกิน */
export async function rateLimit(db: D1Database, key: string, limit: number, windowSec: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, count, window_start) VALUES (?1, 1, ?2)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN 1 ELSE rate_limits.count + 1 END,
         window_start = CASE WHEN rate_limits.window_start <= ?2 - ?3 THEN ?2 ELSE rate_limits.window_start END
       RETURNING count`,
    )
    .bind(key, now, windowSec)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= limit;
}
