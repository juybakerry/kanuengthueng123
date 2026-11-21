/** 8. ลูกค้า — ค้นหาเร็ว ป้าย "ลูกค้าประจำ" ประวัติการเข้าพัก แก้ไข/ลบข้อมูลส่วนตัวตาม PDPA (FR-14) */
import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Star, UserX } from 'lucide-react';
import { useStore, save, getState } from '../lib/store';
import { open } from '../app/nav';
import { viewOf, initials, telHref } from '../app/derive';
import { Empty, Field, IC, IC16, Pill, Sheet, Toggle, confirmDialog, toast } from '../app/ui';
import { fmtDate, fmtRange } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { STAR_LABELS } from '../domain/defaults';
import type { Customer } from '../domain/types';

export function Customers() {
  const ds = useStore((s) => s.ds);
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Customer | null>(null);

  const rows = useMemo(() => {
    return ds.customers
      .map((c) => {
        const stays = ds.bookings.filter((b) => b.customerId === c.id).sort((a, b) => b.checkIn.localeCompare(a.checkIn));
        const real = stays.filter((b) => b.status !== 'cancelled' && b.status !== 'no_show');
        const spent = real.reduce((s, b) => s + b.total, 0);
        return { c, stays, visits: real.length, last: real[0]?.checkIn, spent, regular: c.isRegular || real.length >= 2 };
      })
      .sort((a, b) => (b.last ?? '').localeCompare(a.last ?? '') || a.c.name.localeCompare(b.c.name, 'th'));
  }, [ds.customers, ds.bookings]);
  const t = q.trim().toLowerCase().replace(/[-\s]/g, '');
  const list = rows.filter((r) => !t || r.c.name.toLowerCase().replace(/\s/g, '').includes(t) || r.c.phone.replace(/\D/g, '').includes(t) || r.c.lineId.toLowerCase().includes(t));
  const surveys = ds.surveys;
  const avg = surveys.length ? surveys.reduce((s, x) => s + x.score, 0) / surveys.length : 0;

  async function erase(c: Customer) {
    const ok = await confirmDialog({
      title: 'ลบข้อมูลส่วนตัวของลูกค้า?',
      body: `ตาม PDPA: ชื่อ เบอร์โทร LINE และอาหารที่แพ้ของ "${c.name}" จะถูกลบจากรายชื่อลูกค้าและการจองทั้งหมด ยอดเงินยังเก็บไว้เพื่อบัญชี ย้อนกลับไม่ได้`,
      yes: 'ลบข้อมูลส่วนตัว',
      danger: true,
    });
    if (!ok) return;
    const anon = 'ลูกค้า (ลบข้อมูลแล้ว)';
    save('customers', { ...c, name: anon, phone: '', lineId: '', allergies: '', notes: '' }, { summary: 'ลบข้อมูลส่วนตัวลูกค้า (PDPA)' });
    for (const b of getState().ds.bookings.filter((x) => x.customerId === c.id)) save('bookings', { ...b, name: anon, phone: '', lineId: '', allergies: '' }, { summary: 'ลบข้อมูลส่วนตัวลูกค้า (PDPA)' });
    toast('ลบข้อมูลส่วนตัวแล้ว');
  }

  return (
    <div className="page">
      <label className="search">
        <Search {...IC} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อหรือเบอร์โทร" aria-label="ค้นหาลูกค้า" />
      </label>
      <div className="small muted">
        ลูกค้าทั้งหมด {rows.length} ราย · ลูกค้าประจำ {rows.filter((r) => r.regular).length} ราย
      </div>
      {surveys.length > 0 && (
        <div className="card">
          <div className="row between">
            <span className="card-title row" style={{ gap: 8 }}>
              <Star {...IC} /> ความพึงพอใจ
            </span>
            <span className="b" style={{ color: '#E8893A', fontSize: 20 }}>
              {avg.toFixed(1)} / 5
            </span>
          </div>
          <div className="small muted">จากแบบประเมิน {surveys.length} ครั้ง</div>
          {[...surveys]
            .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
            .slice(0, 3)
            .map((s) => {
              const b = ds.bookings.find((x) => x.id === s.bookingId);
              return (
                <button key={s.id} type="button" className="list-row" onClick={() => b && open({ k: 'booking', id: b.id })}>
                  <span className="grow" style={{ lineHeight: 1.45 }}>
                    <span className="b" style={{ display: 'block' }}>
                      <span style={{ color: '#E8893A' }}>{'★'.repeat(s.score)}</span> {STAR_LABELS[s.score]}
                    </span>
                    <span className="small muted">
                      {b?.name ?? ''}
                      {s.comment ? ` · “${s.comment.slice(0, 80)}”` : s.tags.length ? ` · ${s.tags.join(', ')}` : ''}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>
      )}
      {list.length === 0 ? (
        <Empty title={q ? 'ไม่พบลูกค้า' : 'ยังไม่มีลูกค้า'} desc={q ? 'ลองพิมพ์ชื่อหรือเบอร์โทรใหม่' : 'ลูกค้าจะถูกบันทึกอัตโนมัติเมื่อสร้างการจอง'} />
      ) : (
        <div className="grid-auto">
          {list.map(({ c, stays, visits, last, spent, regular }) => {
            const isOpen = openId === c.id;
            return (
              <div key={c.id} className="card" style={{ padding: 0, gap: 0, overflow: 'hidden' }}>
                <button type="button" className="row" style={{ padding: '14px 16px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', width: '100%' }} onClick={() => setOpenId(isOpen ? null : c.id)} aria-expanded={isOpen}>
                  <span className="heading" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--color-surface-2)', color: 'var(--color-primary)', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                    {initials(c.name)}
                  </span>
                  <div className="grow" style={{ lineHeight: 1.45 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <span className="b">{c.name}</span>
                      {regular && <span className="tag-regular">ลูกค้าประจำ</span>}
                    </div>
                    <div className="small muted">
                      เข้าพัก {visits} ครั้ง{last ? ` · ล่าสุด ${fmtDate(last)}` : ''}
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="col gap8" style={{ padding: '0 16px 14px', animation: 'sheetUp 200ms var(--ease)' }}>
                    <div className="small muted">
                      {c.phone ? <a href={telHref(c.phone)}>{c.phone}</a> : 'ไม่มีเบอร์'} {c.lineId ? ` · LINE ${c.lineId}` : ''} · ยอดรวม {fmtBaht(spent)}
                    </div>
                    {c.allergies && <div className="small">อาหารที่แพ้: {c.allergies}</div>}
                    {c.notes && <div className="small" style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</div>}
                    {stays.map((b) => (
                      <button key={b.id} type="button" className="list-row" style={{ fontSize: 15 }} onClick={() => open({ k: 'booking', id: b.id })}>
                        <span className="grow">{fmtRange(b.checkIn, b.checkOut)}</span>
                        <Pill kind={viewOf(b, ds.payments).pill} />
                      </button>
                    ))}
                    <div className="row gap8">
                      <button type="button" className="btn btn-primary btn-sm grow" onClick={() => open({ k: 'form', init: { customerId: c.id } })}>
                        <Plus {...IC16} />
                        จองให้ลูกค้าคนนี้
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit(c)} aria-label="แก้ไขข้อมูลลูกค้า">
                        <Pencil {...IC16} />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => void erase(c)} aria-label="ลบข้อมูลส่วนตัว (PDPA)" title="ลบข้อมูลส่วนตัว (PDPA)">
                        <UserX {...IC16} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {edit && <EditCustomer c={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditCustomer({ c, onClose }: { c: Customer; onClose: () => void }) {
  const [v, setV] = useState(c);
  return (
    <Sheet onClose={onClose} label="แก้ไขข้อมูลลูกค้า">
      <div className="heading" style={{ fontSize: 20 }}>
        แก้ไขข้อมูลลูกค้า
      </div>
      <Field label="ชื่อ">
        <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <Field label="เบอร์โทร">
        <input className="input" inputMode="tel" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
      </Field>
      <Field label="LINE ID">
        <input className="input" value={v.lineId} onChange={(e) => setV({ ...v, lineId: e.target.value })} />
      </Field>
      <Field label="อาหารที่แพ้">
        <input className="input" value={v.allergies} onChange={(e) => setV({ ...v, allergies: e.target.value })} />
      </Field>
      <Field label="หมายเหตุ">
        <textarea className="textarea" value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </Field>
      <Toggle on={v.isRegular} onChange={(x) => setV({ ...v, isRegular: x })} title="ลูกค้าประจำ" desc="แสดงป้ายลูกค้าประจำแม้พักครั้งเดียว" />
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={!v.name.trim()}
        onClick={() => {
          save('customers', { ...v, name: v.name.trim() });
          toast('บันทึกข้อมูลลูกค้าแล้ว');
          onClose();
        }}
      >
        บันทึก
      </button>
    </Sheet>
  );
}
