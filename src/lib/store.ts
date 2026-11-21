/**
 * ข้อมูลของแอป: เก็บในเครื่อง (IndexedDB) + คิวรอซิงก์ + ดึงการเปลี่ยนแปลงจากเซิร์ฟเวอร์ทุกไม่กี่วินาที
 * - บันทึกในเครื่องก่อนเสมอ แล้วส่งขึ้นเซิร์ฟเวอร์เมื่อมีสัญญาณ (FR-17)
 * - ถ้าอีกเครื่องแก้รายการเดียวกันไปก่อน จะเตือนให้ผู้ใช้เลือก (conflict)
 */
import { useSyncExternalStore } from 'react';
import { api, ApiError, reportError } from './api';
import { idbClear, idbGet, idbSet } from './idb';
import { DEFAULT_SETTINGS } from '../domain/defaults';
import type { AuditEntry, Dataset, Settings, TableName, UserInfo } from '../domain/types';

export type Tbl = TableName | 'settings' | 'audit';

export interface Rec {
  tbl: Tbl;
  id: string;
  data: Record<string, unknown>;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Op {
  opId: string;
  tbl: Tbl;
  id: string;
  data: Record<string, unknown>;
  base: string | null;
  delete?: boolean;
  force?: boolean;
  summary?: string;
  at: number;
}

export interface Conflict {
  op: Op;
  server: Rec | null;
  message: string;
}

interface Persisted {
  v: 2;
  userId: string;
  seq: number;
  epoch: string;
  records: Rec[];
  outbox: Op[];
}

export interface StoreState {
  booted: boolean;
  user: UserInfo | null;
  device: string;
  vapidPublicKey: string;
  ds: Dataset;
  online: boolean;
  syncing: boolean;
  loaded: boolean;
  pending: number;
  conflicts: Conflict[];
  lastSyncAt: number;
  errors: string[];
}

const key = (tbl: string, id: string) => `${tbl}:${id}`;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const newId = uid;

let server = new Map<string, Rec>();
let outbox: Op[] = [];
let seq = 0;
let epoch = '';
let version = 0;
let flushing = false;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const pendingFiles = new Map<string, Blob>();

let state: StoreState = {
  booted: false,
  user: null,
  device: '',
  vapidPublicKey: '',
  ds: emptyDataset(),
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  loaded: false,
  pending: 0,
  conflicts: [],
  lastSyncAt: 0,
  errors: [],
};

function emptyDataset(): Dataset {
  return { settings: DEFAULT_SETTINGS, rooms: [], customers: [], bookings: [], payments: [], closures: [], priceRules: [], issues: [], categories: [], fixedCosts: [], requests: [], surveys: [], audit: [] };
}

function emit() {
  version++;
  for (const l of listeners) l();
}

function set(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  emit();
}

/** รวมข้อมูลจากเซิร์ฟเวอร์ + รายการที่ยังรอซิงก์ → Dataset ที่หน้าจอใช้ */
function rebuild() {
  const merged = new Map(server);
  for (const op of outbox) {
    const k = key(op.tbl, op.id);
    const prev = merged.get(k);
    merged.set(k, { tbl: op.tbl, id: op.id, data: op.delete ? (prev?.data ?? op.data) : op.data, updatedAt: prev?.updatedAt ?? '', deletedAt: op.delete ? new Date().toISOString() : null });
  }
  const ds = emptyDataset();
  for (const r of merged.values()) {
    if (r.deletedAt) continue;
    const v = { ...r.data, id: r.id, updatedAt: r.updatedAt };
    if (r.tbl === 'settings') ds.settings = { ...DEFAULT_SETTINGS, ...(r.data as Partial<Settings>), homestay: { ...DEFAULT_SETTINGS.homestay, ...((r.data as Partial<Settings>).homestay ?? {}) } };
    else (ds as unknown as Record<string, unknown[]>)[r.tbl]?.push(v);
  }
  ds.rooms.sort((a, b) => a.sortOrder - b.sortOrder);
  ds.categories.sort((a, b) => a.sortOrder - b.sortOrder);
  ds.audit.sort((a: AuditEntry, b: AuditEntry) => b.at.localeCompare(a.at));
  state = { ...state, ds, pending: outbox.length };
  emit();
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    if (!state.user) return;
    const p: Persisted = { v: 2, userId: state.user.id, seq, epoch, records: [...server.values()], outbox };
    void idbSet('state', p);
  }, 300);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** อ่านค่าจาก store และ render ใหม่เมื่อข้อมูลเปลี่ยน (ใช้เลขเวอร์ชันเป็น snapshot) */
export function useStore<T>(sel: (s: StoreState) => T): T {
  useSyncExternalStore(subscribe, () => version);
  return sel(state);
}
export const getState = () => state;
export const getVersion = () => version;

/* ---------------- เริ่มต้น / เข้าสู่ระบบ ---------------- */

export async function boot(): Promise<void> {
  const cached = await idbGet<Persisted>('state');
  const cachedUser = await idbGet<UserInfo>('user');
  const files = (await idbGet<Array<[string, Blob]>>('pendingFiles')) ?? [];
  for (const [id, b] of files) pendingFiles.set(id, b);
  if (cached?.v === 2 && cachedUser && cached.userId === cachedUser.id) {
    server = new Map(cached.records.map((r) => [key(r.tbl, r.id), r]));
    outbox = cached.outbox ?? [];
    seq = cached.seq;
    epoch = cached.epoch;
    state = { ...state, user: cachedUser, loaded: server.size > 0 };
    rebuild();
  }
  try {
    const me = await api<{ user: UserInfo | null; device: string | null; vapidPublicKey: string }>('/api/me', { timeoutMs: 8000 });
    if (!me.user) {
      await resetLocal();
      set({ booted: true, user: null });
      return;
    }
    if (cachedUser && cachedUser.id !== me.user.id) await resetLocal();
    await idbSet('user', me.user);
    set({ booted: true, user: me.user, device: me.device ?? '', vapidPublicKey: me.vapidPublicKey, online: true });
    startSync();
  } catch {
    // ออฟไลน์: ใช้ข้อมูลในเครื่องไปก่อน ถ้าเคยเข้าสู่ระบบไว้
    set({ booted: true, online: false });
    if (state.user) startSync();
  }
}

export async function afterLogin(user: UserInfo, device: string) {
  await resetLocal();
  await idbSet('user', user);
  const me = await api<{ vapidPublicKey: string }>('/api/me').catch(() => ({ vapidPublicKey: '' }));
  set({ user, device, vapidPublicKey: me.vapidPublicKey, online: true });
  startSync();
}

async function resetLocal() {
  server = new Map();
  outbox = [];
  seq = 0;
  epoch = '';
  pendingFiles.clear();
  await idbClear();
  state = { ...state, loaded: false, conflicts: [] };
  rebuild();
}

export async function logout() {
  stopSync();
  await api('/api/logout', { method: 'POST' }).catch(() => {});
  await resetLocal();
  set({ user: null });
}

/* ---------------- ซิงก์ ---------------- */

function startSync() {
  stopSync();
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  void tick();
}

function stopSync() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  document.removeEventListener('visibilitychange', onVisible);
}

const onOnline = () => {
  set({ online: true });
  void tick();
};
const onOffline = () => set({ online: false });
const onVisible = () => {
  if (document.visibilityState === 'visible') void tick();
};

let failCount = 0;
async function tick() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
  if (!state.user) return;
  let ok = true;
  try {
    await flush();
    await pull();
    failCount = 0;
    if (!state.online) {
      const n = state.pending;
      set({ online: true });
      if (n === 0) toastHook?.('สัญญาณกลับมาแล้ว · ซิงก์เรียบร้อย');
    }
  } catch (e) {
    ok = false;
    if (e instanceof ApiError && e.status === 401) {
      await resetLocal();
      set({ user: null });
      return;
    }
    failCount++;
    if (e instanceof ApiError && e.code === 'OFFLINE') set({ online: false });
  }
  const visible = document.visibilityState === 'visible';
  const delay = ok ? (visible ? 4000 : 30000) : Math.min(30000, 3000 * failCount);
  pollTimer = setTimeout(() => void tick(), delay);
}

export function syncNow() {
  void tick();
}

async function pull() {
  for (let guard = 0; guard < 50; guard++) {
    const r = await api<{ epoch: string; seq: number; more: boolean; records: Rec[] }>(`/api/sync?since=${seq}`);
    if (epoch && r.epoch !== epoch) {
      // ข้อมูลบนเซิร์ฟเวอร์ถูกกู้คืน → โหลดใหม่ทั้งหมด (คิวที่ค้างยังอยู่)
      server = new Map();
      seq = 0;
      epoch = r.epoch;
      continue;
    }
    epoch = r.epoch;
    for (const rec of r.records) server.set(key(rec.tbl, rec.id), rec);
    const changed = r.records.length > 0 || !state.loaded;
    seq = r.seq;
    if (changed) {
      state = { ...state, loaded: true, lastSyncAt: Date.now() };
      rebuild();
      persist();
    } else set({ lastSyncAt: Date.now() });
    if (!r.more) break;
  }
}

async function uploadPendingFiles() {
  for (const [id, blob] of [...pendingFiles]) {
    await api('/api/files', { raw: blob, headers: { 'Content-Type': blob.type || 'image/webp', 'X-File-Id': id }, timeoutMs: 60000 });
    pendingFiles.delete(id);
    await idbSet('pendingFiles', [...pendingFiles]);
  }
}

async function flush() {
  if (flushing || !outbox.length) return;
  flushing = true;
  set({ syncing: true });
  try {
    await uploadPendingFiles();
    while (outbox.length) {
      const batch = outbox.slice(0, 20);
      const res = await api<{ results: Array<{ opId: string; status: string; record?: Rec | null; error?: string }> }>('/api/mutate', {
        body: { ops: batch.map(({ at: _at, ...o }) => o) },
        timeoutMs: 30000,
      });
      for (const r of res.results) {
        const op = batch.find((o) => o.opId === r.opId);
        if (!op) continue;
        outbox = outbox.filter((o) => o.opId !== r.opId);
        const k = key(op.tbl, op.id);
        const before = server.get(k);
        if (r.record) server.set(k, r.record);
        if (r.status === 'ok' || r.status === 'dup') {
          // ต่อสายฐานเวลาให้รายการถัดไปของรายการเดียวกัน
          const newBase = r.record?.updatedAt ?? null;
          for (const o of outbox) if (o.tbl === op.tbl && o.id === op.id && o.base === (before?.updatedAt ?? null)) o.base = newBase;
        } else if (r.status === 'conflict') {
          state = { ...state, conflicts: [...state.conflicts, { op, server: r.record ?? null, message: r.error ?? 'ข้อมูลชนกัน' }] };
          outbox = outbox.filter((o) => !(o.tbl === op.tbl && o.id === op.id));
        } else {
          if (!r.record && !before) server.delete(k);
          outbox = outbox.filter((o) => !(o.tbl === op.tbl && o.id === op.id));
          const msg = r.error ?? 'บันทึกไม่สำเร็จ';
          state = { ...state, errors: [...state.errors, msg] };
          toastHook?.(msg, 'error');
        }
      }
      rebuild();
      persist();
    }
  } finally {
    flushing = false;
    set({ syncing: false });
  }
}

let toastHook: ((msg: string, kind?: 'ok' | 'error') => void) | null = null;
export function setToastHook(fn: typeof toastHook) {
  toastHook = fn;
}

/* ---------------- เขียนข้อมูล ---------------- */

export interface SaveOpts {
  summary?: string;
}

/** บันทึก (สร้าง/แก้ไข) รายการหนึ่ง — เห็นผลในเครื่องทันที แล้วส่งขึ้นเซิร์ฟเวอร์ */
export function save<T extends { id: string }>(tbl: Tbl, value: T, opts: SaveOpts = {}): T {
  const { id, updatedAt: _u, deletedAt: _d, ...data } = value as T & { updatedAt?: string; deletedAt?: string };
  const base = server.get(key(tbl, id))?.updatedAt ?? null;
  outbox.push({ opId: uid(), tbl, id, data: data as Record<string, unknown>, base, summary: opts.summary, at: Date.now() });
  rebuild();
  persist();
  void tick();
  return value;
}

export function remove(tbl: Tbl, id: string, opts: SaveOpts = {}) {
  const cur = server.get(key(tbl, id));
  const queued = [...outbox].reverse().find((o) => o.tbl === tbl && o.id === id);
  if (!cur) {
    // ยังไม่เคยขึ้นเซิร์ฟเวอร์ → ลบออกจากคิวเฉย ๆ
    outbox = outbox.filter((o) => !(o.tbl === tbl && o.id === id));
  } else outbox.push({ opId: uid(), tbl, id, data: queued?.data ?? cur.data, base: cur.updatedAt, delete: true, summary: opts.summary, at: Date.now() });
  rebuild();
  persist();
  void tick();
}

/** แก้ข้อมูลชนกัน: ใช้ของฉัน (ส่งทับ) หรือใช้ของอีกเครื่อง */
export function resolveConflict(c: Conflict, useMine: boolean) {
  state = { ...state, conflicts: state.conflicts.filter((x) => x !== c) };
  if (useMine) outbox.push({ ...c.op, opId: uid(), base: c.server?.updatedAt ?? null, force: true, at: Date.now() });
  rebuild();
  persist();
  void tick();
}

export function dismissErrors() {
  set({ errors: [] });
}

/* ---------------- รูปภาพ ---------------- */

/** ย่อรูปเป็น WebP ≤ ~200 KB (ด้านยาวสุด 1600px) แล้วเก็บในคิวอัปโหลด คืน id ของไฟล์ */
export async function addImage(file: File | Blob): Promise<string> {
  const blob = await compressImage(file);
  const id = uid();
  pendingFiles.set(id, blob);
  await idbSet('pendingFiles', [...pendingFiles]);
  void tick();
  return id;
}

export function fileUrl(id: string): string {
  const b = pendingFiles.get(id);
  if (b) return URL.createObjectURL(b);
  return `/api/files/${id}`;
}

async function compressImage(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  let max = 1600;
  for (let attempt = 0; attempt < 5; attempt++) {
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    for (const q of [0.8, 0.65, 0.5]) {
      const out = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/webp', q));
      // Safari บางรุ่นไม่รองรับ WebP → ใช้ JPEG แทน
      const b = out && out.type === 'image/webp' ? out : await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', q));
      if (b && b.size <= 200_000) return b;
    }
    max = Math.round(max * 0.75);
  }
  return new Promise<Blob>((r) => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = Math.round((bmp.height / bmp.width) * 800);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    c.toBlob((b) => r(b ?? file), 'image/jpeg', 0.5);
  });
}

window.addEventListener?.('error', (e) => reportError(String(e.message), String(e.error?.stack ?? '')));
window.addEventListener?.('unhandledrejection', (e) => reportError(String((e.reason as Error)?.message ?? e.reason), String((e.reason as Error)?.stack ?? '')));
