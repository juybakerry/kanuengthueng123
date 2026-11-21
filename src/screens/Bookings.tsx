/** รายการการจอง — ค้นหาชื่อ/เบอร์ ตัวกรองสถานะ แยก "กำลังพัก และที่จะมาถึง" กับ "ผ่านไปแล้ว" */
import { useMemo, useState } from 'react';
import { Car, Search } from 'lucide-react';
import { useStore } from '../lib/store';
import { open, useNav } from '../app/nav';
import { viewOf, roomNames, type BookingView } from '../app/derive';
import { Chips, Empty, IC, IC16, Pill, Skeleton } from '../app/ui';
import { fmtRange, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { CHANNEL_LABEL } from '../domain/defaults';

type Filter = 'all' | 'due' | 'unpaid' | 'deposit' | 'paid' | 'staying' | 'cancelled';

export function Bookings() {
  const ds = useStore((s) => s.ds);
  const loaded = useStore((s) => s.loaded);
  const nav = useNav();
  const [q, setQ] = useState('');
  const [f, setF] = useState<Filter>((nav.params.get('f') as Filter) || 'all');
  const today = todayISO();

  const all = useMemo(() => ds.bookings.map((b) => viewOf(b, ds.payments)), [ds.bookings, ds.payments]);
  const qn = q.trim().toLowerCase().replace(/[-\s]/g, '');
  const match = (v: BookingView) => {
    if (qn && !(v.b.name.toLowerCase().replace(/\s/g, '').includes(qn) || v.b.phone.replace(/\D/g, '').includes(qn) || v.b.code.toLowerCase().includes(qn) || v.b.lineId.toLowerCase().includes(qn))) return false;
    const cancelled = v.b.status === 'cancelled' || v.b.status === 'no_show';
    if (f === 'cancelled') return cancelled;
    if (cancelled) return false;
    if (f === 'due') return v.due > 0;
    if (f === 'staying') return v.b.status === 'checked_in';
    if (f === 'unpaid' || f === 'deposit' || f === 'paid') return v.pay === f;
    return true;
  };
  const list = all.filter(match);
  const upcoming = list.filter((v) => v.b.checkOut >= today && v.b.status !== 'checked_out' && v.b.status !== 'cancelled' && v.b.status !== 'no_show').sort((a, b) => a.b.checkIn.localeCompare(b.b.checkIn));
  const past = list.filter((v) => !upcoming.includes(v)).sort((a, b) => b.b.checkIn.localeCompare(a.b.checkIn));
  const [showPast, setShowPast] = useState(30);

  return (
    <div className="page">
      <label className="search">
        <Search {...IC} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อลูกค้า เบอร์โทร หรือเลขที่การจอง" aria-label="ค้นหาการจอง" />
      </label>
      <Chips
        filter
        scroll
        value={f}
        onChange={setF}
        options={[
          { v: 'all', label: 'ทั้งหมด' },
          { v: 'due', label: 'ค้างชำระ' },
          { v: 'unpaid', label: 'ยังไม่ชำระ' },
          { v: 'deposit', label: 'มัดจำแล้ว' },
          { v: 'paid', label: 'ชำระครบ' },
          { v: 'staying', label: 'กำลังพัก' },
          { v: 'cancelled', label: 'ยกเลิก' },
        ]}
      />
      {!loaded ? (
        <Skeleton />
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <h2 className="card-title" style={{ marginTop: 4 }}>
                กำลังพัก และที่จะมาถึง
              </h2>
              <div className="grid-auto">
                {upcoming.map((v) => (
                  <button key={v.b.id} type="button" className="card" style={{ border: 'none', textAlign: 'left', cursor: 'pointer', padding: '14px 16px', gap: 8 }} onClick={() => open({ k: 'booking', id: v.b.id })}>
                    <div className="row-top between" style={{ gap: 10 }}>
                      <div className="b" style={{ fontSize: 17, lineHeight: 1.4, minWidth: 0 }}>
                        {v.b.name}
                      </div>
                      <Pill kind={v.pill} />
                    </div>
                    <div className="row between" style={{ alignItems: 'flex-end', gap: 10 }}>
                      <div style={{ lineHeight: 1.45, minWidth: 0 }}>
                        <div style={{ fontSize: 15 }}>
                          {fmtRange(v.b.checkIn, v.b.checkOut)} · {v.nights} คืน
                        </div>
                        <div className="small muted row" style={{ gap: 6 }}>
                          {v.guests} คน · {roomNames(v.b, ds)}
                          {v.b.usesTransport && <Car {...IC16} aria-label="ใช้รถรับส่ง" />}
                        </div>
                      </div>
                      <span className="b num" style={{ fontSize: 17 }}>
                        {fmtBaht(v.b.total)}
                      </span>
                    </div>
                    {v.due > 0 && v.pay !== 'unpaid' && <div className="small ember">ค้าง {fmtBaht(v.due)}</div>}
                  </button>
                ))}
              </div>
            </>
          )}
          {past.length > 0 && (
            <>
              <h2 className="card-title muted" style={{ marginTop: 8 }}>
                {f === 'cancelled' ? 'ยกเลิก / ไม่มาเข้าพัก' : 'ผ่านไปแล้ว'}
              </h2>
              <div className="grid-auto">
                {past.slice(0, showPast).map((v) => (
                  <button key={v.b.id} type="button" className="card" style={{ border: 'none', textAlign: 'left', cursor: 'pointer', padding: '12px 16px', flexDirection: 'row', justifyContent: 'space-between', opacity: 0.85, boxShadow: 'none' }} onClick={() => open({ k: 'booking', id: v.b.id })}>
                    <div style={{ lineHeight: 1.45, minWidth: 0 }}>
                      <div className="b">{v.b.name}</div>
                      <div className="small muted">
                        {fmtRange(v.b.checkIn, v.b.checkOut)} · {CHANNEL_LABEL[v.b.channel]}
                      </div>
                    </div>
                    <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                      <span className="b num">{fmtBaht(v.b.total)}</span>
                      {(v.due > 0 || v.b.status === 'cancelled') && <Pill kind={v.pill} />}
                    </div>
                  </button>
                ))}
              </div>
              {past.length > showPast && (
                <button type="button" className="btn btn-ghost" onClick={() => setShowPast(showPast + 50)}>
                  แสดงเพิ่ม ({past.length - showPast} รายการ)
                </button>
              )}
            </>
          )}
          {!list.length && (
            <Empty
              title={q || f !== 'all' ? 'ไม่พบการจองที่ตรงกับคำค้น' : 'ยังไม่มีการจอง'}
              desc={q || f !== 'all' ? 'ลองพิมพ์ชื่อหรือเบอร์โทรใหม่ หรือเปลี่ยนตัวกรอง' : 'กด "จองใหม่" เพื่อบันทึกการจองแรก'}
              action={!q && f === 'all' ? <button type="button" className="btn btn-accent" onClick={() => open({ k: 'form', init: {} })}>จองใหม่</button> : undefined}
            />
          )}
        </>
      )}
    </div>
  );
}
