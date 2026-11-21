/** รูปสลิป/รูปปัญหา เก็บใน D1 (ไม่ต้องใช้ R2 ที่ต้องผูกบัตร) · แอปย่อรูปเป็น WebP ≤ 200 KB ก่อนอัปโหลด */
import type { Env } from './env';
import type { Session } from './auth';
import { HttpError, json, nowIso } from './http';

const MAX = 600_000;
const MIME = ['image/webp', 'image/jpeg', 'image/png'];

export async function uploadFile(req: Request, env: Env, s: Session): Promise<Response> {
  const mime = (req.headers.get('content-type') ?? '').split(';')[0]!.trim();
  if (!MIME.includes(mime)) throw new HttpError(415, 'รองรับเฉพาะรูปภาพ (WebP, JPEG, PNG)', 'TYPE');
  const id = req.headers.get('x-file-id') ?? crypto.randomUUID();
  if (!/^[\w-]{8,64}$/.test(id)) throw new HttpError(400, 'รหัสไฟล์ไม่ถูกต้อง', 'VALIDATION');
  const buf = await req.arrayBuffer();
  if (buf.byteLength > MAX) throw new HttpError(413, 'รูปใหญ่เกินไป ลองถ่ายใหม่หรือเลือกรูปที่เล็กลง', 'TOO_LARGE');
  if (buf.byteLength < 20) throw new HttpError(400, 'ไฟล์รูปว่างเปล่า', 'VALIDATION');
  await env.DB.prepare('INSERT OR IGNORE INTO files (id, mime, size, data, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(id, mime, buf.byteLength, buf, s.user.id, nowIso()).run();
  return json({ id, size: buf.byteLength });
}

export async function getFile(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare('SELECT mime, data FROM files WHERE id = ?').bind(id).first<{ mime: string; data: ArrayBuffer | number[] }>();
  if (!row) throw new HttpError(404, 'ไม่พบรูป', 'NOT_FOUND');
  const bytes = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : new Uint8Array(row.data);
  return new Response(bytes, { headers: { 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}

export async function storageUsage(env: Env): Promise<{ files: number; fileBytes: number }> {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS b FROM files').first<{ n: number; b: number }>();
  return { files: r?.n ?? 0, fileBytes: r?.b ?? 0 };
}
