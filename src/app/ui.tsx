/** องค์ประกอบหน้าจอที่ใช้ซ้ำ (ปุ่ม ป้าย สวิตช์ แผ่นล่าง กล่องยืนยัน แจ้งผล) */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Ban, Check, Clock, CloudCheck, CloudOff, Hourglass, House, Lock, LogOut, RefreshCw, X } from 'lucide-react';
import { PILL, type PillKind } from './derive';
import { useStore, syncNow } from '../lib/store';
import { parseBaht } from '../domain/money';
import type { Satang } from '../domain/types';

export const IC = { size: 20, strokeWidth: 1.75 } as const;
export const IC16 = { size: 16, strokeWidth: 1.75 } as const;
export const IC24 = { size: 24, strokeWidth: 1.75 } as const;

/** ไอคอนครึ่งวงกลม (มัดจำ) */
export function HalfCircle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

const PILL_ICON: Record<PillKind, ReactNode> = {
  unpaid: <Clock size={14} strokeWidth={2} />,
  deposit: <HalfCircle />,
  paid: <Check size={14} strokeWidth={2.25} />,
  checkedin: <House size={14} strokeWidth={2} />,
  closed: <Lock size={14} strokeWidth={2} />,
  cancelled: <Ban size={14} strokeWidth={2} />,
  noshow: <Ban size={14} strokeWidth={2} />,
  pending: <Hourglass size={14} strokeWidth={2} />,
  out: <LogOut size={14} strokeWidth={2} />,
};

export function Pill({ kind, label, large }: { kind: PillKind; label?: string; large?: boolean }) {
  const p = PILL[kind];
  return (
    <span className={`status-pill${large ? ' lg' : ''}`} style={{ background: p.bg, color: p.fg }}>
      {PILL_ICON[kind]}
      {label ?? p.label}
    </span>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ v: T; label: ReactNode }>; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.v} type="button" aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chips<T extends string>({ value, options, onChange, filter, scroll }: { value: T | null; options: Array<{ v: T; label: ReactNode; style?: React.CSSProperties }>; onChange: (v: T) => void; filter?: boolean; scroll?: boolean }) {
  return (
    <div className={`chips${scroll ? ' scroll' : ''}`}>
      {options.map((o) => (
        <button key={o.v} type="button" className={`chip${filter ? ' filter' : ''}`} aria-pressed={o.v === value} onClick={() => onChange(o.v)} style={o.v === value ? o.style : undefined}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ on, onChange, title, desc, icon, color }: { on: boolean; onChange: (v: boolean) => void; title: ReactNode; desc?: ReactNode; icon?: ReactNode; color?: string }) {
  return (
    <button type="button" className="toggle-row" role="switch" aria-checked={on} onClick={() => onChange(!on)}>
      {icon && <span style={{ color: 'var(--color-primary)' }}>{icon}</span>}
      <span className="grow" style={{ lineHeight: 1.4 }}>
        <span className="b" style={{ display: 'block' }}>
          {title}
        </span>
        {desc && <span className="small muted" style={{ display: 'block' }}>{desc}</span>}
      </span>
      <span className={`switch${on ? ' on' : ''}`} style={on && color ? { background: color } : undefined} />
    </button>
  );
}

export function Stepper({ label, desc, value, min = 0, max = 99, onChange }: { label: string; desc?: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <span className="grow" style={{ lineHeight: 1.4 }}>
        <span className="b" style={{ display: 'block' }}>
          {label}
        </span>
        {desc && <span className="small muted">{desc}</span>}
      </span>
      <button type="button" aria-label={`ลด${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M5 12h14" /></svg>
      </button>
      <span className="v" aria-live="polite">{value}</span>
      <button type="button" aria-label={`เพิ่ม${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"><path d="M5 12h14M12 5v14" /></svg>
      </button>
    </div>
  );
}

/** ช่องกรอกเงินบาท (เก็บเป็นสตางค์) */
export function MoneyInput({ value, onChange, placeholder, ariaLabel, width }: { value: Satang | null; onChange: (v: Satang | null) => void; placeholder?: string; ariaLabel?: string; width?: number | string }) {
  const [text, setText] = useState(value == null ? '' : String(value / 100));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      setText(value == null ? '' : String(value / 100));
      last.current = value;
    }
  }, [value]);
  return (
    <input
      className="input money"
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder ?? '0'}
      value={text}
      style={width ? { width } : undefined}
      onChange={(e) => {
        const t = e.target.value.replace(/[^\d.,]/g, '');
        setText(t);
        const v = parseBaht(t);
        last.current = v;
        onChange(v);
      }}
    />
  );
}

export function Field({ label, children, full }: { label: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <label className="field" style={full ? { gridColumn: '1 / -1' } : undefined}>
      {label}
      {children}
    </label>
  );
}

export function Contour({ w = 260, h = 110 }: { w?: number; h?: number }) {
  return (
    <svg className="contour" width={w} height={h} viewBox="0 0 260 110" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <path d="M0 90 C 50 50, 90 70, 130 36 S 200 20, 270 50" />
      <path d="M0 104 C 55 64, 95 84, 140 52 S 210 36, 270 66" />
      <path d="M20 118 C 70 80, 110 100, 150 68 S 220 52, 270 82" />
    </svg>
  );
}

export function Empty({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <svg className="mtn" width="160" height="64" viewBox="0 0 160 64" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 60 L44 18 L62 34 L88 8 L122 44 L136 32 L158 60" />
        <path d="M30 60 C 60 50, 100 50, 130 60" opacity=".5" />
      </svg>
      <div className="b">{title}</div>
      {desc && <div className="muted" style={{ fontSize: 15 }}>{desc}</div>}
      {action}
    </div>
  );
}

export function Skeleton({ h = 72, n = 3 }: { h?: number; n?: number }) {
  return (
    <div className="col gap12" aria-busy="true" aria-label="กำลังโหลด">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: h }} />
      ))}
    </div>
  );
}

export function SyncChip({ glass }: { glass?: boolean }) {
  const { online, pending, syncing } = useStore((s) => ({ online: s.online, pending: s.pending, syncing: s.syncing }));
  const off = !online || pending > 0;
  return (
    <button type="button" className={`sync-chip${off ? ' off' : ''}${glass && !off ? ' glass' : ''}`} onClick={() => syncNow()} title="แตะเพื่อซิงก์ตอนนี้">
      {off ? online && syncing ? <RefreshCw {...IC16} /> : <CloudOff {...IC16} /> : <CloudCheck {...IC16} />}
      {off ? `รอซิงก์${pending ? ` ${pending}` : ''}` : 'บันทึกแล้ว'}
    </button>
  );
}

export function Sheet({ onClose, children, label }: { onClose: () => void; children: ReactNode; label: string }) {
  useEscape(onClose);
  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label}>
        <div>
          <span className="grip" />
          {children}
        </div>
      </div>
    </>
  );
}

export function useEscape(fn: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && fn();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [fn]);
}

export function CloseBtn({ onClick, label = 'ปิด' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="icon-btn" aria-label={label} onClick={onClick}>
      <X {...IC} />
    </button>
  );
}

/* ---------- กล่องยืนยัน (คืนค่าเป็น Promise) ---------- */

interface ConfirmOpts {
  title: string;
  body?: ReactNode;
  yes: string;
  no?: string;
  danger?: boolean;
}

export function confirmDialog(o: ConfirmOpts): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (v: boolean) => {
      root.unmount();
      host.remove();
      resolve(v);
    };
    root.render(<ConfirmBox o={o} done={done} />);
  });
}

function ConfirmBox({ o, done }: { o: ConfirmOpts; done: (v: boolean) => void }) {
  useEscape(() => done(false));
  return (
    <div className="dialog" role="alertdialog" aria-modal="true" aria-label={o.title} onClick={(e) => e.target === e.currentTarget && done(false)}>
      <div>
        <div className="heading" style={{ fontSize: 20 }}>
          {o.title}
        </div>
        {o.body && <div className="muted" style={{ fontSize: 15, lineHeight: 1.6 }}>{o.body}</div>}
        <div className="row gap8" style={{ marginTop: 4 }}>
          <button type="button" className="btn btn-secondary grow" onClick={() => done(false)}>
            {o.no ?? 'ยกเลิก'}
          </button>
          <button type="button" className={`btn grow ${o.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => done(true)} autoFocus>
            {o.yes}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- แจ้งผล (toast) พร้อม "เลิกทำ" ---------- */

interface ToastItem {
  id: number;
  msg: string;
  kind: 'ok' | 'error';
  undo?: () => void;
}
let toasts: ToastItem[] = [];
const tsubs = new Set<() => void>();
let tid = 0;

export function toast(msg: string, opts: { kind?: 'ok' | 'error'; undo?: () => void } = {}) {
  const t: ToastItem = { id: ++tid, msg, kind: opts.kind ?? 'ok', undo: opts.undo };
  toasts = [...toasts.slice(-1), t];
  tsubs.forEach((f) => f());
  setTimeout(() => {
    toasts = toasts.filter((x) => x.id !== t.id);
    tsubs.forEach((f) => f());
  }, opts.undo ? 5000 : opts.kind === 'error' ? 5000 : 2600);
}

export function Toasts() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    tsubs.add(f);
    return () => {
      tsubs.delete(f);
    };
  }, []);
  if (!toasts.length) return null;
  const t = toasts[toasts.length - 1]!;
  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <div className="toast" key={t.id}>
        <span style={{ color: t.kind === 'error' ? '#F08C78' : '#8FB89C', display: 'flex' }}>{t.kind === 'error' ? <X {...IC} /> : <Check {...IC} />}</span>
        <span className="grow" style={{ fontSize: 15, lineHeight: 1.45 }}>
          {t.msg}
        </span>
        {t.undo && (
          <button
            type="button"
            className="undo"
            onClick={() => {
              t.undo!();
              toasts = toasts.filter((x) => x.id !== t.id);
              tsubs.forEach((f) => f());
            }}
          >
            เลิกทำ
          </button>
        )}
      </div>
    </div>
  );
}
