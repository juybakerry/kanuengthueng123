/**
 * สำรองข้อมูล (SRS ส่วนที่ 10)
 * - ทุกวัน 03:00 เก็บสำเนา (gzip) ไว้ในฐานข้อมูล 30 วันล่าสุด + วันที่ 1 ของทุกเดือน 12 เดือน
 * - ดาวน์โหลดไฟล์ JSON ได้จากหน้าตั้งค่า · กู้คืนจากไฟล์ได้ (เฉพาะเจ้าของกิจการ)
 * - นอกจากนี้ Cloudflare D1 มี Time Travel ย้อนหลังได้อีกชั้นหนึ่ง (ดู README)
 */
import type { Env } from './env';
import type { Session } from './auth';
import { HttpError, json, nowIso, readJson } from './http';
import { storageUsage } from './files';
import type { RecordRow } from './records';
import { addDays, nightsOf, todayISO } from '../src/domain/dates';
import { isActiveBooking, type Booking } from '../src/domain/types';

interface ExportFile {
  app: 'kanuengthueng';
  version: 2;
  exportedAt: string;
  records: Array<Omit<RecordRow, 'seq'>>;
}

async function snapshot(env: Env): Promise<ExportFile> {
  const { results } = await env.DB.prepare('SELECT tbl, id, data, updated_at, deleted_at FROM records ORDER BY tbl, id').all<Omit<RecordRow, 'seq'>>();
  return { app: 'kanuengthueng', version: 2, exportedAt: nowIso(), records: results };
}

async function gzip(text: string): Promise<ArrayBuffer> {
  const cs = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(cs).arrayBuffer();
}
async function gunzip(buf: ArrayBuffer): Promise<string> {
  const ds = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(ds).text();
}

export async function runBackup(env: Env): Promise<{ id: string; size: number; rows: number }> {
  const snap = await snapshot(env);
  const data = await gzip(JSON.stringify(snap));
  if (data.byteLength > 1_900_000) throw new Error(`backup too large for one row: ${data.byteLength}`);
  const id = todayISO();
  await env.DB.prepare('INSERT INTO backups (id, at, rows, size, data) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET at = excluded.at, rows = excluded.rows, size = excluded.size, data = excluded.data')
    .bind(id, nowIso(), snap.records.length, data.byteLength, data)
    .run();
  // เก็บ 30 วันล่าสุด + วันที่ 1 ของเดือน (12 เดือน)
  const keepFrom = addDays(id, -30);
  const yearAgo = addDays(id, -366);
  await env.DB.prepare(`DELETE FROM backups WHERE id < ? AND (substr(id, 9, 2) <> '01' OR id < ?)`).bind(keepFrom, yearAgo).run();
  return { id, size: data.byteLength, rows: snap.records.length };
}

export async function backupRoute(req: Request, env: Env, s: Session, path: string): Promise<Response> {
  if (path === '/api/export.json' && req.method === 'GET') {
    const snap = await snapshot(env);
    return new Response(JSON.stringify(snap), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="kanuengthueng-${todayISO()}.json"`, 'Cache-Control': 'no-store' },
    });
  }
  if (path === '/api/backups' && req.method === 'GET') {
    const { results } = await env.DB.prepare('SELECT id, at, rows, size FROM backups ORDER BY id DESC LIMIT 60').all();
    const usage = await storageUsage(env);
    const counts = await env.DB.prepare(`SELECT COUNT(*) AS n FROM records`).first<{ n: number }>();
    return json({ backups: results, usage: { ...usage, records: counts?.n ?? 0 } });
  }
  if (path === '/api/backups/run' && req.method === 'POST') return json(await runBackup(env));
  const m = path.match(/^\/api\/backups\/(\d{4}-\d{2}-\d{2})$/);
  if (m && req.method === 'GET') {
    const row = await env.DB.prepare('SELECT data FROM backups WHERE id = ?').bind(m[1]).first<{ data: ArrayBuffer | number[] }>();
    if (!row) throw new HttpError(404, 'ไม่พบไฟล์สำรอง', 'NOT_FOUND');
    const buf = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer;
    return new Response(await gunzip(buf), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="kanuengthueng-backup-${m[1]}.json"` } });
  }
  if (path === '/api/restore' && req.method === 'POST') {
    if (s.user.role !== 'owner') throw new HttpError(403, 'เฉพาะเจ้าของกิจการกู้คืนข้อมูลได้', 'FORBIDDEN');
    const file = await readJson<ExportFile>(req, 30_000_000);
    if (file?.app !== 'kanuengthueng' || !Array.isArray(file.records)) throw new HttpError(400, 'ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปคะนึงถึง', 'VALIDATION');
    await runBackup(env); // เก็บสำเนาก่อนกู้คืนไว้เสมอ
    return json(await restore(env, file));
  }
  throw new HttpError(404, 'ไม่พบหน้า', 'NOT_FOUND');
}

async function restore(env: Env, file: ExportFile): Promise<{ rows: number }> {
  const db = env.DB;
  const seqRow = await db.prepare(`SELECT value FROM meta WHERE key = 'seq'`).first<{ value: string }>();
  let seq = Number(seqRow?.value ?? 0);
  await db.batch([
    db.prepare(`INSERT INTO meta (key, value) VALUES ('restoring', '1') ON CONFLICT(key) DO UPDATE SET value = '1'`),
    db.prepare('DELETE FROM records'),
    db.prepare('DELETE FROM booking_nights'),
  ]);
  try {
    const stmts: D1PreparedStatement[] = [];
    for (const r of file.records) {
      if (typeof r.tbl !== 'string' || typeof r.id !== 'string' || typeof r.data !== 'string') continue;
      seq++;
      stmts.push(db.prepare('INSERT OR REPLACE INTO records (tbl, id, data, seq, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)').bind(r.tbl, r.id, r.data, seq, r.updated_at ?? nowIso(), r.deleted_at ?? null));
      if (r.tbl === 'bookings' && !r.deleted_at) {
        const b = { ...JSON.parse(r.data), id: r.id } as Booking;
        if (isActiveBooking(b)) for (const n of nightsOf(b.checkIn, b.checkOut)) for (const a of b.rooms) stmts.push(db.prepare('INSERT OR IGNORE INTO booking_nights (booking_id, room_id, night, guests, whole) VALUES (?, ?, ?, ?, ?)').bind(b.id, a.roomId, n, a.guests, a.whole ? 1 : 0));
      }
    }
    for (let i = 0; i < stmts.length; i += 80) await db.batch(stmts.slice(i, i + 80));
  } finally {
    await db.batch([
      db.prepare(`UPDATE meta SET value = ? WHERE key = 'seq'`).bind(String(seq + 1)),
      db.prepare(`INSERT INTO meta (key, value) VALUES ('epoch', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(nowIso()),
      db.prepare(`DELETE FROM meta WHERE key = 'restoring'`),
    ]);
  }
  return { rows: file.records.length };
}
