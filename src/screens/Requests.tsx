/** คำขอจองออนไลน์ (ระยะที่ 2) — ลูกค้าส่งจากหน้า /book แล้วพนักงาน "รับจอง" หรือ "ปฏิเสธ" (FR-22) */
import { useState } from 'react';
import { Copy, ExternalLink, MessageCircle, Phone } from 'lucide-react';
import { useStore, save } from '../lib/store';
import { open } from '../app/nav';
import { telHref } from '../app/derive';
import { Chips, Empty, IC16, confirmDialog, toast } from '../app/ui';
import { copyText } from '../lib/share';
import { fmtDateTime, fmtRange, nightsOf } from '../domain/dates';
import { minDayFree } from '../domain/capacity';

export function Requests() {
  const ds = useStore((s) => s.ds);
  const [f, setF] = useState<'new' | 'done'>('new');
  const list = ds.requests.filter((r) => (f === 'new' ? r.status === 'new' : r.status !== 'new')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const ctx = { rooms: ds.rooms, bookings: ds.bookings, closures: ds.closures };
  const link = `${location.origin}/book`;

  return (
    <div className="page">
      <div className="card" style={{ gap: 8 }}>
        <div className="card-title">ลิงก์หน้าจองออนไลน์</div>
        <div className="small muted">ส่งลิงก์นี้ให้ลูกค้า หรือใส่ไว้ในเพจ Facebook / LINE OA · ลูกค้าเห็นแค่วันว่าง ไม่เห็นข้อมูลลูกค้าคนอื่น</div>
        <div className="row wrap gap8">
          <code style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-surface-2)', fontSize: 14, wordBreak: 'break-all' }}>{link}</code>
          <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await copyText(link); toast('คัดลอกลิงก์แล้ว'); }}>
            <Copy {...IC16} /> คัดลอก
          </button>
          <a className="btn btn-ghost btn-sm" href="/book" target="_blank" rel="noopener">
            <ExternalLink {...IC16} /> เปิดดู
          </a>
        </div>
        {!ds.settings.publicBooking && <div className="alert warn">ตอนนี้ปิดรับจองออนไลน์อยู่ เปิดได้ที่ ตั้งค่า › หน้าจองออนไลน์</div>}
      </div>
      <Chips filter value={f} onChange={setF} options={[{ v: 'new', label: `รอตอบ (${ds.requests.filter((r) => r.status === 'new').length})` }, { v: 'done', label: 'ตอบแล้ว' }]} />
      {list.length === 0 ? (
        <Empty title={f === 'new' ? 'ไม่มีคำขอที่รอตอบ' : 'ยังไม่มีคำขอที่ตอบแล้ว'} desc="คำขอจองจากหน้าเว็บของลูกค้าจะขึ้นที่นี่ พร้อมแจ้งเตือนทุกเครื่อง" />
      ) : (
        <div className="grid-auto">
          {list.map((r) => {
            const nights = nightsOf(r.checkIn, r.checkOut);
            const free = minDayFree(nights, ctx);
            const guests = r.adults + r.children;
            return (
              <div key={r.id} className="card" style={{ gap: 8 }}>
                <div className="row-top between">
                  <div style={{ lineHeight: 1.45 }}>
                    <div className="b" style={{ fontSize: 17 }}>
                      {r.name}
                    </div>
                    <div className="small muted">ส่งเมื่อ {fmtDateTime(r.createdAt)}</div>
                  </div>
                  {r.status !== 'new' && <span className="status-pill" style={{ background: r.status === 'accepted' ? '#3F7A4A' : '#8A8F8B', color: r.status === 'accepted' ? '#fff' : '#1F2320' }}>{r.status === 'accepted' ? 'รับจองแล้ว' : 'ปฏิเสธแล้ว'}</span>}
                </div>
                <div style={{ fontSize: 15 }}>
                  {fmtRange(r.checkIn, r.checkOut)} · {nights.length} คืน · {guests} คน{r.children ? ` (เด็ก ${r.children})` : ''}
                </div>
                {r.status === 'new' && <div className={`small b ${guests > free ? 'danger' : 'ok'}`}>{guests > free ? `ตอนนี้ว่างไม่พอ (เหลือ ${free} ที่)` : `ยังว่างพอ (เหลือ ${free} ที่)`}</div>}
                {r.message && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>“{r.message}”</div>}
                <div className="row wrap gap8 small">
                  <a className="btn btn-ghost btn-sm" href={telHref(r.phone)}>
                    <Phone {...IC16} /> {r.phone}
                  </a>
                  {r.lineId && (
                    <span className="row" style={{ gap: 4 }}>
                      <MessageCircle {...IC16} /> {r.lineId}
                    </span>
                  )}
                </div>
                {r.status === 'new' ? (
                  <div className="row gap8">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={async () => {
                        if (await confirmDialog({ title: 'ปฏิเสธคำขอนี้?', body: 'อย่าลืมแจ้งลูกค้าทางโทรศัพท์หรือ LINE', yes: 'ปฏิเสธ', danger: true })) {
                          save('requests', { ...r, status: 'declined' });
                          toast('ปฏิเสธคำขอแล้ว', { undo: () => save('requests', { ...r }) });
                        }
                      }}
                    >
                      ปฏิเสธ
                    </button>
                    <button type="button" className="btn btn-primary btn-sm grow" onClick={() => open({ k: 'form', init: { requestId: r.id } })}>
                      รับจอง
                    </button>
                  </div>
                ) : (
                  r.bookingId && (
                    <button type="button" className="btn btn-text btn-sm" onClick={() => open({ k: 'booking', id: r.bookingId! })}>
                      ดูการจอง
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
