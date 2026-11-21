/** 3. ปฏิทิน — รายเดือน / รายสัปดาห์ / ห้อง × วัน (FR-02) · ปัดซ้าย-ขวาเปลี่ยนเดือน · ลายเส้นทแยง = ปิด */
import { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Lock, Plus } from 'lucide-react';
import { useStore } from '../lib/store';
import { open } from '../app/nav';
import { barColor, barText, viewOf, PILL, type BookingView } from '../app/derive';
import { IC, IC16, Pill, Seg } from '../app/ui';
import { addDays, addMonths, dayOfWeek, daysInclusive, endOfMonth, fmtDate, fmtDateLong, fmtMonth, fmtRange, startOfMonth, TH_DAYS_SHORT, todayISO } from '../domain/dates';
import { activeRooms, closureFor, dayFree, houseCapacity, houseClosed, roomFree, usageOn } from '../domain/capacity';
import { isActiveBooking } from '../domain/types';

type View = 'month' | 'week' | 'timeline';

export function CalendarScreen() {
  const ds = useStore((s) => s.ds);
  const today = todayISO();
  const [view, setView] = useState<View>(() => (sessionStorage.getItem('kt-cal-view') as View) || 'month');
  const [ym, setYm] = useState(startOfMonth(today));
  const [weekStart, setWeekStart] = useState(addDays(today, -dayOfWeek(today)));
  const [tlStart, setTlStart] = useState(today);
  const [sel, setSel] = useState(today);
  const touch = useRef<{ x: number; y: number } | null>(null);

  const views = useMemo(() => ds.bookings.filter(isActiveBooking).map((b) => viewOf(b, ds.payments)), [ds.bookings, ds.payments]);
  const ctx = { rooms: ds.rooms, bookings: ds.bookings, closures: ds.closures };
  const cap = houseCapacity(ds.rooms);
  const rooms = activeRooms(ds.rooms);
  const staying = (d: string) => views.filter((v) => v.b.checkIn <= d && d < v.b.checkOut);

  const setV = (v: View) => {
    setView(v);
    sessionStorage.setItem('kt-cal-view', v);
  };
  const prev = () => (view === 'month' ? setYm(addMonths(ym, -1)) : view === 'week' ? setWeekStart(addDays(weekStart, -7)) : setTlStart(addDays(tlStart, -14)));
  const next = () => (view === 'month' ? setYm(addMonths(ym, 1)) : view === 'week' ? setWeekStart(addDays(weekStart, 7)) : setTlStart(addDays(tlStart, 14)));
  const title = view === 'month' ? fmtMonth(ym.slice(0, 7)) : view === 'week' ? fmtRange(weekStart, addDays(weekStart, 6)) : fmtRange(tlStart, addDays(tlStart, 13));

  const first = startOfMonth(ym);
  const gridStart = addDays(first, -dayOfWeek(first));
  const last = endOfMonth(ym);
  const gridEnd = addDays(last, 6 - dayOfWeek(last));
  const cells = daysInclusive(gridStart, gridEnd);

  return (
    <div className="page">
      <Seg value={view} onChange={setV} label="มุมมองปฏิทิน" options={[{ v: 'month', label: 'รายเดือน' }, { v: 'week', label: 'รายสัปดาห์' }, { v: 'timeline', label: 'ห้อง × วัน' }]} />
      <div className="row gap8">
        <button type="button" className="icon-btn" aria-label="ก่อนหน้า" onClick={prev}>
          <ChevronLeft {...IC} />
        </button>
        <div className="heading grow center" style={{ fontSize: 20 }}>
          {title}
        </div>
        <button type="button" className="icon-btn" aria-label="ถัดไป" onClick={next}>
          <ChevronRight {...IC} />
        </button>
      </div>
      {(view === 'month' ? !(today >= first && today <= last) : view === 'week' ? !(today >= weekStart && today <= addDays(weekStart, 6)) : tlStart !== today) && (
        <button
          type="button"
          className="btn btn-text btn-sm"
          style={{ alignSelf: 'center', marginTop: -10 }}
          onClick={() => {
            setYm(startOfMonth(today));
            setWeekStart(addDays(today, -dayOfWeek(today)));
            setTlStart(today);
            setSel(today);
          }}
        >
          กลับมาวันนี้
        </button>
      )}

      {view === 'month' && (
        <>
          <div
            className="cal-grid"
            onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
            onTouchEnd={(e) => {
              const t = touch.current;
              if (!t) return;
              const dx = e.changedTouches[0]!.clientX - t.x;
              const dy = e.changedTouches[0]!.clientY - t.y;
              if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : prev)();
              touch.current = null;
            }}
          >
            {TH_DAYS_SHORT.map((d) => (
              <div key={d} className="cal-dow">
                {d}
              </div>
            ))}
            {cells.map((d) => {
              const inMonth = d >= first && d <= last;
              if (!inMonth) return <div key={d} className="cal-cell out" aria-hidden />;
              const free = dayFree(d, ctx);
              const list = staying(d);
              const anyClosed = !!houseClosed(d, ds.closures) || rooms.some((r) => closureFor(d, r.id, ds.closures));
              const fullClosed = !!houseClosed(d, ds.closures);
              return (
                <button
                  key={d}
                  type="button"
                  className={`cal-cell${d === today ? ' today' : ''}${d === sel ? ' sel' : ''}${fullClosed ? ' hatch' : ''}`}
                  onClick={() => setSel(d)}
                  aria-label={`${fmtDateLong(d)} เหลือ ${free} ที่`}
                  aria-pressed={d === sel}
                >
                  <div className="row between" style={{ alignItems: 'flex-start', gap: 2, lineHeight: 1.2 }}>
                    <span className="d">{Number(d.slice(8))}</span>
                    <span className="free" style={{ color: free === 0 ? 'var(--danger-text)' : free <= 6 ? 'var(--color-accent-strong)' : undefined }}>
                      {fullClosed ? '' : free === 0 ? 'เต็ม' : free < cap ? <FreeLabel free={free} cap={cap} /> : ''}
                    </span>
                  </div>
                  <div className="bars">
                    {anyClosed && !fullClosed && <Lock size={12} strokeWidth={2} color="var(--color-text-muted)" />}
                    {list.slice(0, 4).map((v, i) => (
                      <div key={v.b.id} className={i >= 3 ? 'label' : undefined} style={{ background: barColor(v), color: barText(v) }}>
                        <span className="label-text">{v.b.name}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="legend">
            <span><i style={{ background: PILL.unpaid.bg }} />ยังไม่ชำระ</span>
            <span><i style={{ background: PILL.deposit.bg }} />มัดจำแล้ว</span>
            <span><i style={{ background: PILL.paid.bg }} />ชำระครบ</span>
            <span><i style={{ background: PILL.checkedin.bg }} />กำลังพัก</span>
            <span><i style={{ background: 'var(--hatch-closed)' }} />ปิด</span>
            <span>ตัวเลขมุมขวา = ที่ว่าง (จาก {cap})</span>
          </div>
          <DayCard day={sel} views={staying(sel)} />
        </>
      )}

      {view === 'week' && (
        <div className="col gap8">
          {daysInclusive(weekStart, addDays(weekStart, 6)).map((d) => {
            const list = staying(d);
            const free = dayFree(d, ctx);
            const closed = houseClosed(d, ds.closures);
            return (
              <div
                key={d}
                className={`card${closed ? ' hatch' : ''}`}
                style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: '12px 14px', background: d === today ? 'var(--color-highlight)' : undefined, cursor: 'pointer' }}
                onClick={() => {
                  setSel(d);
                  setYm(startOfMonth(d));
                  setV('month');
                }}
              >
                <div style={{ width: 76, flex: 'none', lineHeight: 1.35 }}>
                  <div className="b">{['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'][dayOfWeek(d)]}</div>
                  <div className="small muted">{fmtDate(d, { year: false })}</div>
                </div>
                <div className="grow row wrap gap6">
                  {closed && <span className="small b">ปิด{closed.reason ? ` · ${closed.reason}` : ''}</span>}
                  {list.map((v) => (
                    <span
                      key={v.b.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        open({ k: 'booking', id: v.b.id });
                      }}
                      style={{ padding: '2px 10px', borderRadius: 999, background: barColor(v), color: barText(v), fontSize: 14, fontWeight: 600 }}
                    >
                      {v.b.name} · {v.guests}
                    </span>
                  ))}
                  {!list.length && !closed && <span className="small muted">ยังไม่มีการจอง</span>}
                </div>
                <span className="small b muted nowrap num">
                  เหลือ {free}/{cap}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {view === 'timeline' && (
        <>
          <div className="tl">
            <div className="tl-grid">
              <div />
              {daysInclusive(tlStart, addDays(tlStart, 13)).map((d) => (
                <div key={d} className="center" style={{ lineHeight: 1.25, borderRadius: 8, background: d === today ? 'var(--color-highlight)' : undefined, padding: '4px 0' }}>
                  <div className="xs muted">{TH_DAYS_SHORT[dayOfWeek(d)]}</div>
                  <div className="b num" style={{ fontSize: 15 }}>
                    {Number(d.slice(8))}
                  </div>
                </div>
              ))}
              {rooms.map((r) => (
                <TimelineRow key={r.id} roomId={r.id} name={r.name} capacity={r.capacity} start={tlStart} today={today} views={views} />
              ))}
            </div>
          </div>
          <div className="small muted">แตะช่องเพื่อเปิดการจอง · ลายเส้นทแยง = ปิดห้อง · ตัวเลข = คนที่พัก/ความจุ</div>
        </>
      )}
    </div>
  );

  function TimelineRow({ roomId, name, capacity, start, today, views }: { roomId: string; name: string; capacity: number; start: string; today: string; views: BookingView[] }) {
    return (
      <>
        <div className="col" style={{ lineHeight: 1.25, justifyContent: 'center' }}>
          <div className="b" style={{ fontSize: 15 }}>
            {name}
          </div>
          <div className="xs muted">{capacity} คน</div>
        </div>
        {daysInclusive(start, addDays(start, 13)).map((d) => {
          const closed = closureFor(d, roomId, ds.closures);
          const list = views.filter((v) => v.b.checkIn <= d && d < v.b.checkOut && v.b.rooms.some((a) => a.roomId === roomId));
          const used = usageOn(d, ds.bookings).get(roomId);
          const free = roomFree(d, ds.rooms.find((x) => x.id === roomId)!, ctx);
          const v = list[0];
          return (
            <button
              key={d}
              type="button"
              className={`tl-cell${d === today ? ' today' : ''}${closed ? ' hatch' : ''}`}
              style={v ? { background: barColor(v), color: barText(v) } : undefined}
              onClick={() => (v ? open({ k: 'booking', id: v.b.id }) : !closed && free > 0 ? open({ k: 'form', init: { checkIn: d } }) : undefined)}
              aria-label={`${name} ${fmtDate(d)} ${closed ? 'ปิด' : v ? `${v.b.name}` : 'ว่าง'}`}
              title={list.map((x) => x.b.name).join(', ')}
            >
              {closed ? <Lock size={14} strokeWidth={2} /> : used ? `${used.guests}/${capacity}` : ''}
            </button>
          );
        })}
      </>
    );
  }

  function DayCard({ day, views }: { day: string; views: BookingView[] }) {
    const free = dayFree(day, ctx);
    const used = views.reduce((s, v) => s + v.guests, 0);
    const use = usageOn(day, ds.bookings);
    const closed = houseClosed(day, ds.closures);
    return (
      <div className="card">
        <div className="row-top between">
          <div style={{ lineHeight: 1.4 }}>
            <div className="card-title">{fmtDateLong(day)}</div>
            <div className="small muted">{closed ? `ปิดรับแขก${closed.reason ? ` · ${closed.reason}` : ''}` : `เข้าพัก ${used} คน · เหลือ ${free}/${cap} ที่`}</div>
          </div>
          {!closed && free > 0 && day >= todayISO() && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => open({ k: 'form', init: { checkIn: day } })}>
              <Plus {...IC16} />
              จองวันนี้
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, rooms.length)}, minmax(0, 1fr))`, gap: 8 }}>
          {rooms.map((r) => {
            const u = use.get(r.id);
            const c = closureFor(day, r.id, ds.closures);
            const g = u?.guests ?? 0;
            return (
              <div key={r.id} className="col gap4" style={{ lineHeight: 1.3 }}>
                <span className="xs muted ellipsis">{r.name}</span>
                <div className={`bar${c ? ' hatch' : ''}`} style={{ height: 6 }}>
                  <div style={{ width: `${(g / r.capacity) * 100}%`, background: u?.whole ? 'var(--color-info)' : undefined }} />
                </div>
                <span className="small b num">{c ? 'ปิด' : u?.whole ? 'ทั้งห้อง' : `${g}/${r.capacity}`}</span>
              </div>
            );
          })}
        </div>
        {views.map((v) => (
          <button key={v.b.id} type="button" className="list-row" onClick={() => open({ k: 'booking', id: v.b.id })}>
            <div className="grow" style={{ lineHeight: 1.45 }}>
              <div className="b">{v.b.name}</div>
              <div className="small muted">
                {v.guests} คน · {v.b.rooms.map((a) => ds.rooms.find((r) => r.id === a.roomId)?.name).join(', ')} · {fmtRange(v.b.checkIn, v.b.checkOut)}
              </div>
            </div>
            <Pill kind={v.pill} />
          </button>
        ))}
        {!views.length && !closed && <div className="muted divider" style={{ fontSize: 15, paddingTop: 8 }}>วันนี้ยังว่างทั้ง {rooms.length} ห้อง</div>}
      </div>
    );
  }
}

function FreeLabel({ free, cap }: { free: number; cap: number }) {
  return (
    <>
      <span className="mobile-only">{free}</span>
      <span className="tablet-only">
        เหลือ {free}/{cap}
      </span>
    </>
  );
}
