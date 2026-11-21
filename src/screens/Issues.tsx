/** 6. แจ้งปัญหา / ค่าใช้จ่าย — หักจากกำไรตามวันที่จ่าย · เงินเรียกคืนจากลูกค้านับเป็นรายรับ (FR-11) */
import { useMemo, useRef, useState } from 'react';
import { Camera, CircleCheck, Plus, Trash } from 'lucide-react';
import { useStore, save, remove, newId, addImage, fileUrl, getState } from '../lib/store';
import { close, open } from '../app/nav';
import { PILL } from '../app/derive';
import { Chips, CloseBtn, Empty, Field, HalfCircle, IC, IC16, IC24, MoneyInput, Toggle, confirmDialog, toast, useEscape } from '../app/ui';
import { addMonths, endOfMonth, fmtDate, fmtMonth, startOfMonth, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { ISSUE_STATUS_LABEL } from '../domain/defaults';
import type { Issue, IssueStatus } from '../domain/types';

const STATUS_PILL: Record<IssueStatus, { bg: string; fg: string }> = {
  open: { bg: PILL.unpaid.bg, fg: PILL.unpaid.fg },
  in_progress: { bg: PILL.deposit.bg, fg: PILL.deposit.fg },
  done: { bg: PILL.paid.bg, fg: PILL.paid.fg },
};
const NEXT: Record<IssueStatus, IssueStatus> = { open: 'in_progress', in_progress: 'done', done: 'open' };

export function Issues() {
  const ds = useStore((s) => s.ds);
  const [f, setF] = useState<'all' | IssueStatus>('all');
  const [month, setMonth] = useState(startOfMonth(todayISO()));
  const from = month;
  const to = endOfMonth(month);
  const inMonth = (i: Issue) => {
    const d = i.paidOn ?? i.occurredOn;
    return d >= from && d <= to;
  };
  const monthCost = ds.issues.filter(inMonth).reduce((s, i) => s + i.amount, 0);
  const monthRec = ds.issues.filter((i) => {
    const d = i.recoverOn ?? i.paidOn ?? i.occurredOn;
    return i.recover > 0 && d >= from && d <= to;
  }).reduce((s, i) => s + i.recover, 0);
  const openCount = ds.issues.filter((i) => i.status !== 'done').length;
  const list = useMemo(
    () => ds.issues.filter((i) => (f === 'all' ? inMonth(i) || i.status !== 'done' : i.status === f)).sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0) || b.occurredOn.localeCompare(a.occurredOn)),
    [ds.issues, f, month], // eslint-disable-line
  );
  const cat = (id: string) => ds.categories.find((c) => c.id === id)?.name ?? 'อื่น ๆ';
  const room = (id: string | null) => (id ? ds.rooms.find((r) => r.id === id)?.name : null);

  return (
    <div className="page">
      <div className="card" style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)', flexDirection: 'row', alignItems: 'center' }}>
        <div className="grow" style={{ lineHeight: 1.4 }}>
          <div className="small" style={{ opacity: 0.85 }}>
            ค่าใช้จ่าย{month === startOfMonth(todayISO()) ? 'เดือนนี้' : fmtMonth(month.slice(0, 7))} (หักจากกำไรตามวันที่จ่าย)
          </div>
          <div className="b num" style={{ fontSize: 28 }}>
            {fmtBaht(monthCost)}
          </div>
          <div className="small" style={{ opacity: 0.85 }}>
            เรียกเก็บคืนจากลูกค้า {fmtBaht(monthRec)} · ค้าง {openCount} เรื่อง
          </div>
        </div>
        <button type="button" className="btn btn-accent" onClick={() => open({ k: 'issue' })}>
          <Camera {...IC} />
          แจ้งปัญหา
        </button>
      </div>
      <div className="row gap8">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(addMonths(month, -1))} aria-label="เดือนก่อน">
          ‹
        </button>
        <span className="grow center b">{fmtMonth(month.slice(0, 7))}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMonth(addMonths(month, 1))} aria-label="เดือนถัดไป">
          ›
        </button>
      </div>
      <Chips filter scroll value={f} onChange={setF} options={[{ v: 'all', label: 'ทั้งหมด' }, { v: 'open', label: 'รอแก้ไข' }, { v: 'in_progress', label: 'กำลังแก้' }, { v: 'done', label: 'เสร็จแล้ว' }]} />
      {list.length === 0 ? (
        <Empty title="ยังไม่มีรายการ" desc="บันทึกปัญหาและค่าใช้จ่าย เพื่อนำไปหักกำไรใน Dashboard" action={<button type="button" className="btn btn-accent" onClick={() => open({ k: 'issue' })}><Plus {...IC} />แจ้งปัญหา</button>} />
      ) : (
        <div className="grid-auto">
          {list.map((i) => (
            <div key={i.id} className="card" style={{ padding: '14px 16px', gap: 8 }}>
              <button type="button" style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }} onClick={() => open({ k: 'issue', id: i.id })}>
                <div className="row-top between" style={{ gap: 10 }}>
                  <span className="b" style={{ fontSize: 16, lineHeight: 1.45 }}>
                    {i.title}
                  </span>
                  <span className="b num nowrap">{fmtBaht(i.amount)}</span>
                </div>
                <div className="small muted" style={{ lineHeight: 1.5 }}>
                  {[fmtDate(i.occurredOn), cat(i.categoryId), room(i.roomId), `แจ้งโดย ${i.reportedBy || '–'}`].filter(Boolean).join(' · ')}
                </div>
              </button>
              <div className="row between" style={{ gap: 8 }}>
                <button
                  type="button"
                  title="แตะเพื่อเปลี่ยนสถานะ"
                  className="status-pill"
                  style={{ height: 32, padding: '0 12px 0 10px', border: 'none', fontSize: 14, cursor: 'pointer', background: STATUS_PILL[i.status].bg, color: STATUS_PILL[i.status].fg }}
                  onClick={() => {
                    const n = NEXT[i.status];
                    save('issues', { ...i, status: n, paidOn: n === 'done' && !i.paidOn && i.amount > 0 ? todayISO() : i.paidOn }, { summary: `เปลี่ยนสถานะ "${i.title}" เป็น ${ISSUE_STATUS_LABEL[n]}` });
                  }}
                >
                  {i.status === 'done' ? <CircleCheck {...IC16} /> : i.status === 'in_progress' ? <HalfCircle /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor' }} />}
                  {ISSUE_STATUS_LABEL[i.status]}
                </button>
                {i.recover > 0 && <span className="small b ok">เรียกคืน {fmtBaht(i.recover)}</span>}
                {i.photoIds.length > 0 && <img className="thumb" src={fileUrl(i.photoIds[0]!)} alt="" style={{ width: 40, height: 40 }} loading="lazy" />}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="small muted">แตะป้ายสถานะเพื่อเปลี่ยน: รอแก้ไข → กำลังแก้ → เสร็จแล้ว</div>
    </div>
  );
}

export function IssueForm({ id, bookingId }: { id?: string; bookingId?: string }) {
  const ds = useStore((s) => s.ds);
  const existing = id ? ds.issues.find((i) => i.id === id) : undefined;
  const booking = (bookingId ?? existing?.bookingId) ? ds.bookings.find((b) => b.id === (bookingId ?? existing?.bookingId)) : undefined;
  const [photos, setPhotos] = useState<string[]>(existing?.photoIds ?? []);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [detail, setDetail] = useState(existing?.detail ?? '');
  const [amount, setAmount] = useState<number | null>(existing?.amount ?? null);
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? ds.categories[0]?.id ?? '');
  const [roomId, setRoomId] = useState<string>(existing?.roomId ?? booking?.rooms[0]?.roomId ?? '');
  const [status, setStatus] = useState<IssueStatus>(existing?.status ?? 'open');
  const [occurredOn, setOccurredOn] = useState(existing?.occurredOn ?? todayISO());
  const [paidOn, setPaidOn] = useState(existing?.paidOn ?? todayISO());
  const [recoverOn, setRecoverOn] = useState(existing?.recoverOn ?? todayISO());
  const [recoverOnOff, setRecover] = useState((existing?.recover ?? 0) > 0);
  const [recAmt, setRecAmt] = useState<number | null>(existing?.recover || null);
  const ref = useRef<HTMLInputElement>(null);
  useEscape(close);
  const ok = title.trim().length > 0 && amount != null;

  function onSave() {
    if (!ok) return;
    const i: Issue = {
      id: existing?.id ?? newId(),
      occurredOn,
      title: title.trim(),
      detail: detail.trim(),
      categoryId,
      amount: amount ?? 0,
      paidOn: (amount ?? 0) > 0 ? paidOn : null,
      status,
      bookingId: booking?.id ?? null,
      roomId: roomId || null,
      photoIds: photos,
      reportedBy: existing?.reportedBy ?? getState().user?.displayName ?? '',
      recover: recoverOnOff ? (recAmt ?? 0) : 0,
      recoverOn: recoverOnOff ? recoverOn : null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };
    save('issues', i, { summary: existing ? `แก้ไขปัญหา "${i.title}"` : `แจ้งปัญหา "${i.title}" ${fmtBaht(i.amount)}` });
    toast(existing ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกปัญหาแล้ว');
    close();
  }

  return (
    <section className="overlay" style={{ zIndex: 45 }} aria-label="แจ้งปัญหา">
      <div className="overlay-head" style={{ padding: '8px 16px' }}>
        <h1>{existing ? 'แก้ไขปัญหา' : 'แจ้งปัญหา'}</h1>
        {existing && (
          <button
            type="button"
            className="icon-btn plain"
            aria-label="ลบรายการ"
            onClick={async () => {
              if (await confirmDialog({ title: 'ลบรายการนี้?', body: existing.title, yes: 'ลบ', danger: true })) {
                remove('issues', existing.id, { summary: `ลบปัญหา "${existing.title}"` });
                toast('ลบรายการแล้ว', { undo: () => save('issues', existing) });
                close();
              }
            }}
          >
            <Trash {...IC} />
          </button>
        )}
        <CloseBtn onClick={close} />
      </div>
      <div className="overlay-body">
        <div className="inner">
          <input
            ref={ref}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setPhotos([...photos, await addImage(f)]);
            }}
          />
          {photos.length > 0 && (
            <div className="row wrap gap8">
              {photos.map((p) => (
                <button key={p} type="button" onClick={() => setPhotos(photos.filter((x) => x !== p))} style={{ border: 'none', padding: 0, background: 'none', position: 'relative' }} aria-label="เอารูปออก">
                  <img src={fileUrl(p)} alt="" className="thumb" style={{ width: 88, height: 88 }} />
                </button>
              ))}
            </div>
          )}
          <button type="button" className="dashed" style={{ height: photos.length ? 64 : 140, flexDirection: 'column', borderRadius: 16, background: 'var(--color-surface)' }} onClick={() => ref.current?.click()}>
            {photos.length ? (
              <span className="row ok" style={{ gap: 8 }}>
                <CircleCheck {...IC} />
                แนบรูปแล้ว {photos.length} รูป · แตะเพื่อถ่ายเพิ่ม (แตะรูปเพื่อเอาออก)
              </span>
            ) : (
              <>
                <Camera {...IC24} />
                ถ่ายรูปปัญหา / ใบเสร็จ
                <span className="small" style={{ fontWeight: 400 }}>
                  เปิดกล้องได้ทันที
                </span>
              </>
            )}
          </button>
          {booking && <div className="alert info">ผูกกับการจองของ {booking.name}</div>}
          <div className="card" style={{ gap: 14 }}>
            <Field label="หัวข้อ / รายละเอียดปัญหา *">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ไฟห้องน้ำห้อง 2 ไม่ติด" />
            </Field>
            <Field label="รายละเอียดเพิ่มเติม">
              <textarea className="textarea" rows={2} value={detail} onChange={(e) => setDetail(e.target.value)} />
            </Field>
            <Field label="จำนวนเงินที่ใช้แก้ไข (บาท) *">
              <MoneyInput value={amount} onChange={setAmount} ariaLabel="จำนวนเงินที่ใช้แก้ไข" />
            </Field>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="วันที่เกิดปัญหา">
                <input className="input" type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value || todayISO())} />
              </Field>
              {(amount ?? 0) > 0 && (
                <Field label="วันที่จ่ายเงิน (หักกำไรวันนี้)">
                  <input className="input" type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value || todayISO())} />
                </Field>
              )}
            </div>
            <div className="field">
              หมวดหมู่
              <Chips value={categoryId} onChange={setCategoryId} options={ds.categories.map((c) => ({ v: c.id, label: c.name }))} />
            </div>
            <div className="field">
              ห้องที่เกี่ยวข้อง
              <Chips value={roomId} onChange={setRoomId} options={[{ v: '', label: 'ไม่ระบุ' }, ...ds.rooms.filter((r) => r.isActive).map((r) => ({ v: r.id, label: r.name }))]} />
            </div>
            <div className="field">
              สถานะ
              <Chips value={status} onChange={setStatus} options={(['open', 'in_progress', 'done'] as IssueStatus[]).map((s) => ({ v: s, label: ISSUE_STATUS_LABEL[s], style: { background: STATUS_PILL[s].bg, color: STATUS_PILL[s].fg } }))} />
            </div>
            <div className="divider" style={{ paddingTop: 10 }}>
              <Toggle on={recoverOnOff} onChange={setRecover} title="เรียกเก็บคืนจากลูกค้า" desc="กรณีความเสียหายเกิดจากลูกค้า · บันทึกเป็นรายรับเพิ่ม" />
            </div>
            {recoverOnOff && (
              <div className="grid-2" style={{ gap: 12 }}>
                <Field label="จำนวนเงินที่เรียกเก็บคืน (บาท)">
                  <MoneyInput value={recAmt} onChange={setRecAmt} ariaLabel="จำนวนเงินที่เรียกเก็บคืน" />
                </Field>
                <Field label="วันที่ได้รับเงินคืน">
                  <input className="input" type="date" value={recoverOn} onChange={(e) => setRecoverOn(e.target.value || todayISO())} />
                </Field>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="overlay-foot">
        <div className="inner">
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!ok} onClick={onSave}>
            บันทึก
          </button>
        </div>
      </div>
    </section>
  );
}
