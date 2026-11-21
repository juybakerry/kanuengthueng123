/** อ่าน/เขียนตาราง records และค่าเริ่มต้นของระบบ */
import type { Env } from './env';
import { nowIso } from './http';
import { uuid } from './crypto';
import { DEFAULT_CATEGORIES, DEFAULT_FIXED_NAMES, DEFAULT_ROOMS, DEFAULT_SETTINGS } from '../src/domain/defaults';
import type { Booking, Closure, Dataset, Room, Settings } from '../src/domain/types';

export interface RecordRow {
  tbl: string;
  id: string;
  data: string;
  seq: number;
  updated_at: string;
  deleted_at: string | null;
}

export interface WireRecord {
  tbl: string;
  id: string;
  data: Record<string, unknown>;
  seq: number;
  updatedAt: string;
  deletedAt: string | null;
}

export const toWire = (r: RecordRow): WireRecord => ({ tbl: r.tbl, id: r.id, data: JSON.parse(r.data), seq: r.seq, updatedAt: r.updated_at, deletedAt: r.deleted_at });

export const BUMP_SEQ = `UPDATE meta SET value = CAST(value AS INTEGER) + 1 WHERE key = 'seq'`;
export const UPSERT = `INSERT INTO records (tbl, id, data, seq, updated_at, deleted_at)
  VALUES (?1, ?2, ?3, (SELECT CAST(value AS INTEGER) FROM meta WHERE key = 'seq'), ?4, ?5)
  ON CONFLICT(tbl, id) DO UPDATE SET data = excluded.data, seq = excluded.seq, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`;

/** คำสั่งเขียนหนึ่งรายการ (ต้องอยู่ใน batch เดียวกันเพื่อให้ seq ถูกต้อง) */
export function writeStmts(db: D1Database, tbl: string, id: string, data: object, updatedAt: string, deletedAt: string | null): D1PreparedStatement[] {
  return [db.prepare(BUMP_SEQ), db.prepare(UPSERT).bind(tbl, id, JSON.stringify(data), updatedAt, deletedAt)];
}

export async function getRecord(db: D1Database, tbl: string, id: string): Promise<RecordRow | null> {
  return db.prepare('SELECT * FROM records WHERE tbl = ? AND id = ?').bind(tbl, id).first<RecordRow>();
}

export async function listTable<T>(db: D1Database, tbl: string, where = '', ...binds: unknown[]): Promise<T[]> {
  const { results } = await db
    .prepare(`SELECT id, data FROM records WHERE tbl = ? AND deleted_at IS NULL ${where}`)
    .bind(tbl, ...binds)
    .all<{ id: string; data: string }>();
  return results.map((r) => ({ ...JSON.parse(r.data), id: r.id }) as T);
}

export async function getSettings(db: D1Database): Promise<Settings> {
  const r = await getRecord(db, 'settings', 'main');
  return r ? { ...DEFAULT_SETTINGS, ...JSON.parse(r.data) } : DEFAULT_SETTINGS;
}

/** การจองที่มีผลและทับช่วง [from, to) */
export async function bookingsOverlapping(db: D1Database, from: string, to: string): Promise<Booking[]> {
  return listTable<Booking>(
    db,
    'bookings',
    `AND json_extract(data, '$.checkOut') > ? AND json_extract(data, '$.checkIn') < ? AND json_extract(data, '$.status') IN ('pending','confirmed','checked_in','checked_out')`,
    from,
    to,
  );
}

export async function capacityCtx(db: D1Database, from: string, to: string): Promise<{ rooms: Room[]; closures: Closure[]; bookings: Booking[] }> {
  const [rooms, closures, bookings] = await Promise.all([
    listTable<Room>(db, 'rooms'),
    listTable<Closure>(db, 'closures', `AND json_extract(data, '$.end') >= ? AND json_extract(data, '$.start') < ?`, from, to),
    bookingsOverlapping(db, from, to),
  ]);
  return { rooms, closures, bookings };
}

/** ใส่ค่าตั้งต้น (ห้อง 5 ห้อง, หมวดค่าใช้จ่าย, ต้นทุนคงที่ว่าง) ครั้งแรกเท่านั้น */
export async function ensureSeed(env: Env): Promise<void> {
  const seeded = await env.DB.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).first<{ value: string }>();
  if (seeded) return;
  const now = nowIso();
  const ym = now.slice(0, 7);
  const stmts: D1PreparedStatement[] = [env.DB.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('seeded', ?)`).bind(now)];
  const add = (tbl: string, id: string, data: object) => stmts.push(...writeStmts(env.DB, tbl, id, data, now, null));
  add('settings', 'main', DEFAULT_SETTINGS);
  for (const { id, ...r } of DEFAULT_ROOMS) add('rooms', id, r);
  for (const { id, ...c } of DEFAULT_CATEGORIES) add('categories', id, c);
  for (const name of DEFAULT_FIXED_NAMES) add('fixedCosts', uuid(), { name, amount: 0, effectiveFrom: ym, effectiveTo: null });
  await env.DB.batch(stmts);
}

/** ข้อมูลทั้งหมดในรูป Dataset (ใช้กับงานสรุป/สำรองข้อมูล) */
export async function loadDataset(db: D1Database): Promise<Dataset> {
  const { results } = await db.prepare(`SELECT tbl, id, data FROM records WHERE deleted_at IS NULL AND tbl <> 'audit'`).all<{ tbl: string; id: string; data: string }>();
  const ds: Dataset = { settings: DEFAULT_SETTINGS, rooms: [], customers: [], bookings: [], payments: [], closures: [], priceRules: [], issues: [], categories: [], fixedCosts: [], requests: [], surveys: [], audit: [] };
  for (const r of results) {
    const v = { ...JSON.parse(r.data), id: r.id };
    if (r.tbl === 'settings') ds.settings = { ...DEFAULT_SETTINGS, ...v };
    else if (r.tbl in ds) (ds as unknown as Record<string, unknown[]>)[r.tbl]!.push(v);
  }
  return ds;
}
