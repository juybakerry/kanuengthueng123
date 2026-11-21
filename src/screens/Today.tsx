/** 2. วันนี้ — เช็คอิน/เอาท์ รถรับส่ง อาหาร ห้องที่ต้องทำความสะอาด ยอดค้างชำระ (FR-10) */
import { useMemo, useState, type ReactNode } from 'react';
import { BedDouble, Car, Check, Circle, Inbox, LogIn, LogOut, Moon, Sparkles, Sun, Utensils } from 'lucide-react';
import { useStore } from '../lib/store';
import { open, go, useNav } from '../app/nav';
import { useTheme } from '../app/theme';
import { viewOf, roomNames, type BookingView } from '../app/derive';
import { checkIn, checkOut } from '../app/actions';
import { IC, Pill, Seg, Skeleton, SyncChip } from '../app/ui';
import { addDays, fmtDate, fmtDateLong, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { activeRooms, closureFor, houseCapacity, usageOn, roomFree } from '../domain/capacity';
import { isActiveBooking } from '../domain/types';

interface Task {
  key: string;
  time: string;
  icon: ReactNode;
  title: string;
  sub: string;
  action?: { label: string; run: () => void };
  open?: () => void;
  checkable?: boolean;
  done?: boolean;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'อรุณสวัสดิ์';
  if (h < 17) return 'สวัสดีตอนบ่าย';
  if (h < 21) return 'สวัสดีตอนเย็น';
  return 'ราตรีสวัสดิ์';
}

function useDone(day: string) {
  const k = `kt-done-${day}`;
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem(k) ?? '{}');
    } catch {
      return {};
    }
  });
  const toggle = (id: string) => {
    const n = { ...done, [id]: !done[id] };
    setDone(n);
    try {
      localStorage.setItem(k, JSON.stringify(n));
    } catch {
      /* ignore */
    }
  };
  return [done, toggle] as const;
}

export function Today() {
  const ds = useStore((s) => s.ds);
  const loaded = useStore((s) => s.loaded);
  const nav = useNav();
  const { theme, toggle } = useTheme();
  const today = todayISO();
  const [which, setWhich] = useState<'today' | 'tomorrow'>(nav.params.get('day') === 'tomorrow' ? 'tomorrow' : 'today');
  const day = which === 'today' ? today : addDays(today, 1);
  const [done, toggleDone] = useDone(day);
  const st = ds.settings;
  const cap = houseCapacity(ds.rooms);

  const views = useMemo(() => ds.bookings.filter(isActiveBooking).map((b) => viewOf(b, ds.payments)), [ds.bookings, ds.payments]);
  const tonight = views.filter((v) => v.b.checkIn <= day && day < v.b.checkOut && v.b.status !== 'pending');
  const guestsTonight = tonight.reduce((s, v) => s + v.guests, 0);
  const ctx = { rooms: ds.rooms, bookings: ds.bookings, closures: ds.closures };
  const freeTonight = activeRooms(ds.rooms).reduce((s, r) => s + roomFree(day, r, ctx), 0);
  const arriving = views.filter((v) => v.b.checkIn === day && v.b.status !== 'pending');
  const leaving = views.filter((v) => v.b.checkOut === day && v.b.status !== 'pending');

  const tasks: Task[] = [];
  const outTime = st.checkOutTime;
  for (const v of leaving) {
    tasks.push({
      key: `out-${v.b.id}`,
      time: outTime,
      icon: <LogOut {...IC} />,
      title: `เช็คเอาท์ ${v.b.name}`,
      sub: `${roomNames(v.b, ds)}${v.due > 0 ? ` · ค้าง ${fmtBaht(v.due)}` : ' · ชำระครบแล้ว'}`,
      open: () => open({ k: 'booking', id: v.b.id }),
      action: v.b.status === 'checked_in' && day === today ? { label: 'เช็คเอาท์', run: () => void checkOut(v.b) } : undefined,
      checkable: v.b.status !== 'checked_in',
      done: v.b.status === 'checked_out',
    });
  }
  const vacated = [...new Set(leaving.flatMap((v) => v.b.rooms.map((r) => r.roomId)))];
  if (vacated.length) {
    const names = vacated.map((id) => ds.rooms.find((r) => r.id === id)?.name ?? '').join(', ');
    const [h, m] = outTime.split(':').map(Number);
    const t = `${String(h! + (m! >= 30 ? 1 : 0)).padStart(2, '0')}:${m! >= 30 ? '00' : '30'}`;
    tasks.push({ key: 'clean', time: t, icon: <Sparkles {...IC} />, title: `ทำความสะอาด ${names}`, sub: `ให้เสร็จก่อนแขกเข้า ${st.checkInTime}`, checkable: true });
  }
  for (const v of arriving.filter((x) => x.b.usesTransport)) {
    tasks.push({ key: `car-${v.b.id}`, time: v.b.pickupTime || '–', icon: <Car {...IC} />, title: `รับ ${v.b.name} ${v.guests} คน`, sub: v.b.pickupPoint || 'ยังไม่ระบุจุดรับ', open: () => open({ k: 'booking', id: v.b.id }), checkable: true });
  }
  for (const v of arriving) {
    tasks.push({
      key: `in-${v.b.id}`,
      time: st.checkInTime,
      icon: <LogIn {...IC} />,
      title: `เช็คอิน ${v.b.name}`,
      sub: `${v.guests} คน · ${roomNames(v.b, ds)}${v.due > 0 ? ` · เก็บ ${fmtBaht(v.due)}` : ''}`,
      open: () => open({ k: 'booking', id: v.b.id }),
      action: v.b.status === 'confirmed' && day === today ? { label: 'เช็คอิน', run: () => void checkIn(v.b) } : undefined,
      checkable: v.b.status !== 'confirmed',
      done: v.b.status === 'checked_in' || v.b.status === 'checked_out',
    });
  }
  if (guestsTonight > 0) {
    const allergies = tonight.filter((v) => v.b.allergies).map((v) => `${v.b.name}: ${v.b.allergies}`);
    tasks.push({ key: 'meal', time: '18:00', icon: <Utensils {...IC} />, title: `เตรียมอาหาร ${guestsTonight} ที่`, sub: allergies.length ? `แพ้อาหาร — ${allergies.join(' · ')}` : 'ไม่มีแขกแจ้งแพ้อาหาร', checkable: true });
  }
  tasks.sort((a, b) => a.time.localeCompare(b.time));

  const dueList = views
    .filter((v) => v.due > 0 && v.b.status !== 'checked_out' && v.b.status !== 'pending')
    .sort((a, b) => a.b.checkIn.localeCompare(b.b.checkIn));
  const dueTotal = dueList.reduce((s, v) => s + v.due, 0);
  const newReq = ds.requests.filter((r) => r.status === 'new').length;
  const use = usageOn(day, ds.bookings);

  return (
    <div className="page" style={{ gap: 24 }}>
      <div className="hero">
        <div className="row gap8">
          <img src="/assets/logo-mark.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
          <span className="heading grow" style={{ fontSize: 20 }}>
            คะนึงถึง
          </span>
          <SyncChip glass />
          <button type="button" className="icon-btn glass mobile-only" aria-label="สลับโหมดหมอกเช้า/กองไฟ" onClick={toggle}>
            {theme === 'mist' ? <Moon {...IC} /> : <Sun {...IC} />}
          </button>
        </div>
        <div className="col gap12">
          <div>
            <div className="heading" style={{ fontSize: 30, lineHeight: 1.25 }}>
              {greeting()}
            </div>
            <div style={{ fontSize: 16, opacity: 0.92 }}>{fmtDateLong(today)}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <div className="stat">
              <b>{guestsTonight} คน</b>
              <span>{which === 'today' ? 'คืนนี้' : 'คืนพรุ่งนี้'}</span>
            </div>
            <div className="stat">
              <b>
                {freeTonight}/{cap}
              </b>
              <span>ที่ว่าง</span>
            </div>
            <div className="stat">
              <b>{arriving.length} กลุ่ม</b>
              <span>เช็คอิน{which === 'today' ? 'วันนี้' : 'พรุ่งนี้'}</span>
            </div>
          </div>
        </div>
      </div>

      <Seg value={which} onChange={setWhich} options={[{ v: 'today', label: `วันนี้ ${fmtDate(today, { year: false })}` }, { v: 'tomorrow', label: `พรุ่งนี้ ${fmtDate(addDays(today, 1), { year: false })}` }]} label="เลือกวัน" />

      {newReq > 0 && (
        <button type="button" className="alert info" style={{ border: 'none', cursor: 'pointer', textAlign: 'left' }} onClick={() => go('requests')}>
          <Inbox {...IC} />
          <span className="grow">
            <b>มีคำขอจองออนไลน์ใหม่ {newReq} รายการ</b>
            <br />
            แตะเพื่อดูและยืนยันการจอง
          </span>
        </button>
      )}

      <div className="grid-2" style={{ gap: 24 }}>
        <div className="col gap12">
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <h2 className="section-title">งาน{which === 'today' ? 'วันนี้' : 'พรุ่งนี้'}</h2>
            <span className="small muted">เรียงตามเวลา</span>
          </div>
          {!loaded ? (
            <Skeleton />
          ) : tasks.length === 0 ? (
            <div className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
              <span className="muted">{which === 'today' ? 'วันนี้' : 'พรุ่งนี้'}ไม่มีแขกเข้าหรือออก</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => open({ k: 'form', init: { checkIn: day } })}>
                จองวันนี้
              </button>
            </div>
          ) : (
            tasks.map((t) => {
              const isDone = t.done || (t.checkable && done[t.key]);
              return (
                <div key={t.key} className={`task${isDone ? ' done' : ''}`}>
                  <div className="time">{t.time}</div>
                  <div className="body">
                    <span className="icon-tile">{t.icon}</span>
                    <div className="grow" style={{ cursor: t.open ? 'pointer' : 'default', lineHeight: 1.45 }} onClick={t.open}>
                      <div className="b ttl">{t.title}</div>
                      <div className="small muted">{t.sub}</div>
                    </div>
                    {t.action ? (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={t.action.run}>
                        {t.action.label}
                      </button>
                    ) : t.checkable ? (
                      <button type="button" className="icon-btn plain" aria-label={isDone ? 'ยังไม่ได้ทำ' : 'ทำแล้ว'} aria-pressed={!!isDone} onClick={() => toggleDone(t.key)} style={{ color: isDone ? 'var(--ok-text)' : 'var(--color-text-muted)' }}>
                        {isDone ? <Check size={24} strokeWidth={2} /> : <Circle size={24} strokeWidth={1.75} />}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="col gap24">
          <div className="card">
            <div className="row-top between">
              <div>
                <div className="card-title">ยอดค้างชำระ</div>
                <div className="small muted">{dueList.length ? `${dueList.length} การจองยังจ่ายไม่ครบ` : 'ไม่มียอดค้าง'}</div>
              </div>
              <span className="b num ember" style={{ fontSize: 28, lineHeight: 1.2 }}>
                {fmtBaht(dueTotal)}
              </span>
            </div>
            {dueList.slice(0, 4).map((v) => (
              <DueRow key={v.b.id} v={v} today={today} />
            ))}
            {dueList.length > 4 && (
              <button type="button" className="btn btn-text btn-sm" onClick={() => go('bookings', '?f=due')}>
                ดูทั้งหมด {dueList.length} รายการ
              </button>
            )}
          </div>

          <div className="card">
            <div className="card-title">{which === 'today' ? 'ห้องคืนนี้' : 'ห้องคืนพรุ่งนี้'}</div>
            {activeRooms(ds.rooms).map((r) => {
              const u = use.get(r.id);
              const closed = closureFor(day, r.id, ds.closures);
              const used = u?.guests ?? 0;
              const cleaning = vacated.includes(r.id);
              const note = closed ? `ปิดห้อง${closed.reason ? ` · ${closed.reason}` : ''}` : cleaning ? 'ต้องทำความสะอาด' : used ? (u?.whole ? 'จองทั้งห้อง' : 'มีแขกคืนนี้') : 'ว่าง';
              return (
                <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '76px minmax(0,1fr) 44px', alignItems: 'center', gap: 12 }}>
                  <div style={{ lineHeight: 1.3 }}>
                    <div className="b" style={{ fontSize: 15 }}>
                      {r.name}
                    </div>
                    <div className={`xs ${cleaning && !closed ? 'ember' : 'muted'}`}>{note}</div>
                  </div>
                  <div className={`bar${closed ? ' hatch' : ''}`}>
                    <div style={{ width: `${Math.min(100, (used / r.capacity) * 100)}%` }} />
                  </div>
                  <span className="b num right" style={{ fontSize: 15 }}>
                    {used}/{r.capacity}
                  </span>
                </div>
              );
            })}
            <div className="row small muted" style={{ gap: 6 }}>
              <BedDouble size={16} strokeWidth={1.75} /> เช็คอิน {st.checkInTime} · เช็คเอาท์ {st.checkOutTime}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DueRow({ v, today }: { v: BookingView; today: string }) {
  const b = v.b;
  let sub = `เก็บวันเข้าพัก ${fmtDate(b.checkIn)}`;
  if (v.paid <= 0) sub = b.depositDueOn < today ? `เลยกำหนดมัดจำ (${fmtDate(b.depositDueOn)})` : `มัดจำภายใน ${fmtDate(b.depositDueOn)}`;
  if (b.checkIn <= today) sub = b.status === 'checked_in' ? 'กำลังพัก · เก็บก่อนเช็คเอาท์' : `เก็บวันนี้`;
  return (
    <button type="button" className="list-row" onClick={() => open({ k: 'booking', id: b.id })}>
      <div className="grow" style={{ lineHeight: 1.45 }}>
        <div className="b" style={{ fontSize: 15 }}>
          {b.name}
        </div>
        <div className={`small ${v.paid <= 0 && b.depositDueOn < today ? 'danger' : 'muted'}`}>{sub}</div>
      </div>
      <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
        <span className="b num">{fmtBaht(v.due)}</span>
        <Pill kind={v.pay} />
      </div>
    </button>
  );
}
