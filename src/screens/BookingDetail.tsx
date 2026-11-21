/** 5. รายละเอียดการจอง — ป้ายสถานะ ปุ่มด่วน (โทร · LINE · ส่ง QR · ใบยืนยัน) การชำระ สลิป ประวัติแก้ไข */
import { useRef, useState } from 'react';
import { Camera, CalendarClock, ChevronLeft, Copy, RotateCcwClock, Image as ImageIcon, MessageCircle, Pencil, Phone, QrCode, Send, Share2, Star, Trash, Wrench, Ban } from 'lucide-react';
import { useStore, addImage, fileUrl, remove, save } from '../lib/store';
import { close, open } from '../app/nav';
import { viewOf, telHref } from '../app/derive';
import { cancelBooking, checkIn, checkOut, recordPayment } from '../app/actions';
import { Chips, Empty, IC, IC16, MoneyInput, Pill, Sheet, confirmDialog, toast, useEscape } from '../app/ui';
import { qrDataUrl, shareFile, shareText, copyText, dataUrlToBlob } from '../lib/share';
import { fmtDate, fmtDateTime, fmtRange, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { promptpayPayload } from '../domain/promptpay';
import { CHANNEL_LABEL, METHOD_LABEL, PAYMENT_KIND_LABEL, STAR_LABELS } from '../domain/defaults';
import type { Booking, PayMethod, PaymentKind, Satang } from '../domain/types';

export function BookingDetail({ id }: { id: string }) {
  const ds = useStore((s) => s.ds);
  const b = ds.bookings.find((x) => x.id === id);
  const [qr, setQr] = useState(false);
  const [pay, setPay] = useState<null | { kind: PaymentKind; amount: Satang }>(null);
  const [viewSlip, setViewSlip] = useState<string | null>(null);
  useEscape(close);

  if (!b) {
    return (
      <section className="overlay">
        <div className="overlay-head">
          <button type="button" className="icon-btn plain" aria-label="ย้อนกลับ" onClick={close}>
            <ChevronLeft size={24} strokeWidth={1.75} />
          </button>
        </div>
        <Empty title="ไม่พบการจองนี้" desc="อาจถูกลบไปแล้ว หรือยังซิงก์ไม่เสร็จ" />
      </section>
    );
  }
  const v = viewOf(b, ds.payments);
  const st = ds.settings;
  const audit = ds.audit.filter((a) => a.rowId === b.id);
  const survey = ds.surveys.find((s) => s.bookingId === b.id);
  const issues = ds.issues.filter((i) => i.bookingId === b.id);
  const cancelled = b.status === 'cancelled' || b.status === 'no_show';
  const today = todayISO();
  const base = location.origin;

  const stayAct =
    b.status === 'confirmed' || b.status === 'pending'
      ? { label: b.checkIn > today ? `เช็คอิน (วันที่ ${fmtDate(b.checkIn, { year: false })})` : 'เช็คอิน', run: () => void checkIn(b) }
      : b.status === 'checked_in'
        ? { label: 'เช็คเอาท์', run: () => void checkOut(b) }
        : b.status === 'checked_out'
          ? { label: survey ? 'ดูผลแบบประเมิน' : 'ส่งแบบประเมินความพึงพอใจ', run: () => void sendSurvey() }
          : null;

  async function sendSurvey() {
    if (!b!.surveyToken) return toast('รอซิงก์ให้เสร็จก่อน แล้วลองใหม่', { kind: 'error' });
    if (survey) {
      document.getElementById('survey-card')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const r = await shareText(`ขอบคุณที่มาพักผ่อนที่${st.homestay.shortName}นะคะ ช่วยให้คะแนนสั้น ๆ ไม่ถึง 30 วินาที ไว้มาพบกันใหม่เน้อ`, `${base}/review/${b!.surveyToken}`);
    if (r === 'copied') toast('คัดลอกลิงก์แบบประเมินแล้ว วางในแชท LINE ของลูกค้าได้เลย');
  }

  async function sendLine() {
    const msg = `สวัสดีค่ะ คุณ${b!.name.replace(/^คุณ/, '')} จาก${st.homestay.name}\nการจองวันที่ ${fmtRange(b!.checkIn, b!.checkOut)} · ${v.guests} คน\nยอดรวม ${fmtBaht(b!.total)}${v.due > 0 ? ` · ค้างชำระ ${fmtBaht(v.due)}` : ' · ชำระครบแล้ว'}`;
    const r = await shareText(msg, b!.surveyToken ? `${base}/pay/${b!.surveyToken}` : undefined);
    if (r === 'copied') toast('คัดลอกข้อความแล้ว วางในแชท LINE ของลูกค้าได้เลย');
  }

  async function markNoShow() {
    const ok = await confirmDialog({ title: 'ลูกค้าไม่มาเข้าพัก?', body: 'บันทึกเป็น "ไม่มาเข้าพัก" ห้องจะว่างและมัดจำที่รับแล้วนับเป็นรายรับ', yes: 'บันทึก', danger: true });
    if (ok) {
      save('bookings', { ...b!, status: 'no_show', cancelledOn: today }, { summary: 'ลูกค้าไม่มาเข้าพัก' });
      toast('บันทึกแล้ว');
    }
  }

  async function restore() {
    const ok = await confirmDialog({ title: 'นำการจองกลับมา?', body: 'ระบบจะตรวจห้องว่างอีกครั้ง ถ้าห้องถูกจองไปแล้วจะบันทึกไม่ได้', yes: 'นำกลับมา' });
    if (ok) {
      save('bookings', { ...b!, status: 'confirmed', cancelledOn: null }, { summary: 'นำการจองที่ยกเลิกกลับมา' });
    }
  }

  return (
    <section className="overlay" aria-label={`การจอง ${b.name}`}>
      <div className="overlay-head">
        <button type="button" className="icon-btn plain" aria-label="ย้อนกลับ" onClick={close}>
          <ChevronLeft size={24} strokeWidth={1.75} />
        </button>
        <span className="grow muted" style={{ fontSize: 15 }}>
          การจอง {b.code || 'รอเลขที่ (รอซิงก์)'}
        </span>
        {!cancelled && (
          <button type="button" className="btn btn-text danger btn-sm" onClick={() => void cancelBooking(b)}>
            <Trash {...IC16} />
            ยกเลิกการจอง
          </button>
        )}
      </div>
      <div className="overlay-body" style={{ paddingBottom: 32 }}>
        <div className="inner">
          <div className="col gap8">
            <div className="row wrap gap8">
              <Pill kind={v.pill} large />
              {(b.status === 'checked_in' || b.status === 'pending') && <Pill kind={v.pay} large />}
              {b.status === 'checked_out' && <Pill kind="out" large />}
            </div>
            <h1 style={{ fontSize: 28 }}>{b.name}</h1>
            <div style={{ lineHeight: 1.5 }}>
              <div className="b" style={{ fontSize: 17 }}>
                {fmtRange(b.checkIn, b.checkOut)}
              </div>
              <div className="small muted">
                {v.nights} คืน · เช็คอิน {st.checkInTime} · เช็คเอาท์ {st.checkOutTime}
                {b.rescheduleCount > 0 ? ` · เลื่อนวันแล้ว ${b.rescheduleCount} ครั้ง` : ''}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <QuickBtn icon={<Phone {...IC} />} label="โทร" href={b.phone ? telHref(b.phone) : undefined} disabled={!b.phone} />
            <QuickBtn icon={<MessageCircle {...IC} />} label="LINE" onClick={() => void sendLine()} />
            <QuickBtn icon={<QrCode {...IC} />} label="ส่ง QR" onClick={() => setQr(true)} disabled={cancelled} />
            <QuickBtn icon={<Send {...IC} />} label="ใบยืนยัน" onClick={() => open({ k: 'doc', id: b.id, kind: v.paid > 0 && v.due === 0 ? 'receipt' : 'confirm' })} />
          </div>

          <div className="card">
            <div className="row between" style={{ alignItems: 'baseline' }}>
              <span className="card-title">การชำระเงิน</span>
              <span className="small muted">{b.nightly.length && b.nightly.every((n) => n.price === b.nightly[0]!.price) ? `${fmtBaht(b.nightly[0]!.price)} × ${v.guests} คน × ${v.nights} คืน` : `${v.nights} คืน (มีราคาพิเศษ)`}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, lineHeight: 1.35 }}>
              <div>
                <div className="small muted">ยอดรวม</div>
                <div className="b num" style={{ fontSize: 20 }}>
                  {fmtBaht(b.total)}
                </div>
              </div>
              <div>
                <div className="small muted">ชำระแล้ว</div>
                <div className="b num ok" style={{ fontSize: 20 }}>
                  {fmtBaht(v.paid)}
                </div>
              </div>
              <div>
                <div className="small muted">คงเหลือ</div>
                <div className="b num ember" style={{ fontSize: 20 }}>
                  {fmtBaht(v.due)}
                </div>
              </div>
            </div>
            <div className="bar">
              <div style={{ width: `${b.total ? Math.min(100, (v.paid / b.total) * 100) : 100}%`, background: '#3F7A4A' }} />
            </div>
            {(b.discount > 0 || b.extra > 0) && (
              <div className="small muted">
                {b.discount > 0 && `ส่วนลด ${fmtBaht(b.discount)} `}
                {b.extra > 0 && `รายการเพิ่ม ${fmtBaht(b.extra)} `}
                {b.extraNote && `(${b.extraNote})`}
              </div>
            )}
            <div className="small muted">
              {v.paid <= 0 ? `มัดจำ ${b.depositPct}% (${fmtBaht(v.deposit)}) ภายใน ${fmtDate(b.depositDueOn)}` : v.due > 0 ? `ส่วนที่เหลือชำระวันเข้าพัก ${fmtDate(b.checkIn)}` : 'ชำระครบแล้ว'} · ยกเลิกไม่คืนมัดจำ · เลื่อนวันได้ {st.rescheduleLimit} ครั้ง
            </div>
            {v.payments.map((p) => (
              <div key={p.id} className="row divider" style={{ paddingTop: 10, alignItems: 'center' }}>
                {p.slipId ? (
                  <button type="button" onClick={() => setViewSlip(p.slipId)} style={{ border: 'none', padding: 0, background: 'none', cursor: 'zoom-in' }} aria-label="ดูสลิป">
                    <img className="thumb" src={fileUrl(p.slipId)} alt="สลิปโอนเงิน" loading="lazy" />
                  </button>
                ) : (
                  <span className="thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                    <ImageIcon {...IC} />
                  </span>
                )}
                <div className="grow" style={{ lineHeight: 1.4 }}>
                  <div className="b" style={{ fontSize: 15 }}>
                    {PAYMENT_KIND_LABEL[p.kind]} {p.kind === 'refund' ? '−' : ''}
                    {fmtBaht(p.amount)}
                  </div>
                  <div className="small muted">
                    {METHOD_LABEL[p.method]} · {fmtDate(p.paidOn)} · รับโดย {p.recordedBy || '–'}
                    {p.note ? ` · ${p.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="icon-btn plain"
                  aria-label="ลบรายการเงินนี้"
                  onClick={async () => {
                    const ok = await confirmDialog({ title: 'ลบรายการเงินนี้?', body: `${PAYMENT_KIND_LABEL[p.kind]} ${fmtBaht(p.amount)} — ใช้เมื่อบันทึกผิด ประวัติการลบจะถูกเก็บไว้`, yes: 'ลบ', danger: true });
                    if (ok) {
                      remove('payments', p.id, { summary: `ลบรายการ${PAYMENT_KIND_LABEL[p.kind]} ${fmtBaht(p.amount)}` });
                      toast('ลบรายการเงินแล้ว');
                    }
                  }}
                >
                  <Trash {...IC16} />
                </button>
              </div>
            ))}
            {!cancelled && (
              <div className="row wrap gap8">
                {v.paid <= 0 && v.deposit < b.total && (
                  <button type="button" className="btn btn-primary grow" onClick={() => setPay({ kind: 'deposit', amount: v.deposit })}>
                    รับมัดจำ {fmtBaht(v.deposit)}
                  </button>
                )}
                {v.due > 0 && (
                  <button type="button" className={`btn grow ${v.paid > 0 ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPay({ kind: v.paid > 0 ? 'balance' : 'deposit', amount: v.due })}>
                    {v.paid > 0 ? `รับส่วนที่เหลือ ${fmtBaht(v.due)}` : 'รับเต็มจำนวน'}
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPay({ kind: v.due > 0 ? 'other' : 'refund', amount: 0 })}>
                  {v.due > 0 ? 'รับยอดอื่น' : 'คืนเงิน / อื่น ๆ'}
                </button>
              </div>
            )}
            {cancelled && v.paid > 0 && (
              <div className="small muted">มัดจำ {fmtBaht(v.paid)} ไม่คืนตามนโยบาย (นับเป็นรายรับวันที่ {fmtDate(b.cancelledOn)}) — ถ้าคืนเงินให้ลูกค้า ให้บันทึก "คืนเงิน"
                <button type="button" className="btn btn-text btn-sm" onClick={() => setPay({ kind: 'refund', amount: v.paid })}>บันทึกคืนเงิน</button>
              </div>
            )}
          </div>

          <div className="card tight">
            <div className="row between" style={{ marginBottom: 6 }}>
              <span className="card-title">ห้องและผู้เข้าพัก</span>
              {!cancelled && b.status !== 'checked_out' && (
                <button type="button" className="btn btn-text btn-sm" onClick={() => open({ k: 'form', init: { editId: b.id } })}>
                  <Pencil {...IC16} />
                  แก้ไข
                </button>
              )}
            </div>
            <div style={{ fontSize: 15, paddingBottom: 8 }}>
              ผู้ใหญ่ {b.adults} คน{b.children ? ` · เด็ก ${b.children} คน` : ''} · รวม {v.guests} คน
            </div>
            <div className="row wrap gap8" style={{ paddingBottom: 8 }}>
              {b.rooms.map((r) => (
                <span key={r.roomId} style={{ padding: '4px 12px', borderRadius: 999, background: 'var(--color-surface-2)', fontSize: 14 }}>
                  <b>{ds.rooms.find((x) => x.id === r.roomId)?.name ?? 'ห้องที่ถูกลบ'}</b> · {r.guests} คน{r.whole ? ' · ทั้งห้อง' : ''}
                </span>
              ))}
            </div>
            <div className="kv">
              <span>รถรับส่ง</span>
              <span>{b.usesTransport ? `${b.pickupTime || 'ยังไม่ระบุเวลา'} · ${b.pickupPoint || 'ยังไม่ระบุจุดรับ'}` : 'ไม่ใช้'}</span>
            </div>
            <div className="kv">
              <span>เบอร์โทร</span>
              <span className="num">{b.phone ? <a href={telHref(b.phone)}>{b.phone}</a> : '–'}</span>
            </div>
            <div className="kv">
              <span>LINE ID</span>
              <span>{b.lineId || '–'}</span>
            </div>
            <div className="kv">
              <span>จองผ่าน</span>
              <span>{CHANNEL_LABEL[b.channel]}</span>
            </div>
            <div className="kv">
              <span>อาหารที่แพ้</span>
              <span>{b.allergies || '–'}</span>
            </div>
            <div className="kv">
              <span>หมายเหตุ</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{b.notes || '–'}</span>
            </div>
            <div className="kv">
              <span>บันทึกโดย</span>
              <span>
                {b.createdBy || '–'} · {fmtDateTime(b.createdAt)}
              </span>
            </div>
          </div>

          <div className="row wrap gap8">
            {!cancelled && b.status !== 'checked_out' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => open({ k: 'form', init: { editId: b.id, reschedule: true } })}>
                <CalendarClock {...IC16} />
                เลื่อนวัน {b.rescheduleCount >= st.rescheduleLimit ? '(ครบสิทธิ์แล้ว)' : ''}
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => open({ k: 'issue', bookingId: b.id })}>
              <Wrench {...IC16} />
              แจ้งปัญหา / ความเสียหาย
            </button>
            {(b.status === 'confirmed' || b.status === 'pending') && b.checkIn <= today && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void markNoShow()}>
                <Ban {...IC16} />
                ไม่มาเข้าพัก
              </button>
            )}
            {cancelled && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void restore()}>
                นำการจองกลับมา
              </button>
            )}
            {b.surveyToken && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  await copyText(`${base}/pay/${b.surveyToken}`);
                  toast('คัดลอกลิงก์หน้าชำระเงินของลูกค้าแล้ว');
                }}
              >
                <Copy {...IC16} />
                ลิงก์ชำระเงินของลูกค้า
              </button>
            )}
          </div>

          {issues.length > 0 && (
            <div className="card tight">
              <span className="card-title" style={{ marginBottom: 6 }}>
                ปัญหาที่เกี่ยวข้อง
              </span>
              {issues.map((i) => (
                <button key={i.id} type="button" className="list-row" onClick={() => open({ k: 'issue', id: i.id })}>
                  <span className="grow">{i.title}</span>
                  <span className="b num">{fmtBaht(i.amount)}</span>
                  {i.recover > 0 && <span className="small ok">เรียกคืน {fmtBaht(i.recover)}</span>}
                </button>
              ))}
            </div>
          )}

          {survey && (
            <div className="card" id="survey-card">
              <span className="card-title row" style={{ gap: 8 }}>
                <Star {...IC} /> แบบประเมินจากลูกค้า
              </span>
              <div className="b" style={{ color: '#E8893A', fontSize: 22 }}>
                {'★'.repeat(survey.score)}
                <span className="muted" style={{ fontSize: 15, marginLeft: 8 }}>
                  {STAR_LABELS[survey.score]}
                </span>
              </div>
              {survey.tags.length > 0 && <div className="small">{survey.tags.join(' · ')}</div>}
              {survey.comment && <div style={{ whiteSpace: 'pre-wrap' }}>“{survey.comment}”</div>}
              <div className="small muted">{fmtDateTime(survey.submittedAt)}</div>
            </div>
          )}

          <div className="card">
            <div className="card-title row" style={{ gap: 8 }}>
              <RotateCcwClock {...IC} />
              ประวัติการแก้ไข
            </div>
            {audit.length === 0 && <div className="small muted">ยังไม่มีประวัติ (รอซิงก์)</div>}
            {audit.slice(0, 30).map((a) => (
              <div key={a.id} className="row-top" style={{ fontSize: 14, lineHeight: 1.5, gap: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-secondary)', marginTop: 7, flex: 'none' }} />
                <span className="grow">
                  <span style={{ display: 'block', fontSize: 15 }}>{a.summary}</span>
                  <span className="muted">
                    {fmtDateTime(a.at)} · {a.actor}
                    {a.device ? ` (${a.device})` : ''}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      {stayAct && (
        <div className="overlay-foot">
          <div className="inner">
            <button type="button" className="btn btn-primary btn-lg btn-block" onClick={stayAct.run}>
              {b.status === 'checked_out' && !survey && <Share2 {...IC} />}
              {stayAct.label}
            </button>
          </div>
        </div>
      )}

      {qr && <QrSheet b={b} due={v.due} paid={v.paid} deposit={v.deposit} onClose={() => setQr(false)} />}
      {pay && <PaySheet b={b} init={pay} due={v.due} onClose={() => setPay(null)} />}
      {viewSlip && (
        <Sheet onClose={() => setViewSlip(null)} label="สลิปโอนเงิน">
          <img src={fileUrl(viewSlip)} alt="สลิปโอนเงิน" style={{ width: '100%', borderRadius: 12 }} />
          <button type="button" className="btn btn-secondary" onClick={() => setViewSlip(null)}>
            ปิด
          </button>
        </Sheet>
      )}
    </section>
  );
}

function QuickBtn({ icon, label, onClick, href, disabled }: { icon: React.ReactNode; label: string; onClick?: () => void; href?: string; disabled?: boolean }) {
  const style: React.CSSProperties = { height: 68, border: 'none', borderRadius: 16, background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 14, color: 'var(--color-text)', cursor: disabled ? 'not-allowed' : 'pointer', textDecoration: 'none', opacity: disabled ? 0.45 : 1 };
  const inner = (
    <>
      <span style={{ color: 'var(--color-primary)', display: 'flex' }}>{icon}</span>
      {label}
    </>
  );
  if (href && !disabled)
    return (
      <a href={href} style={style}>
        {inner}
      </a>
    );
  return (
    <button type="button" style={style} onClick={onClick} disabled={disabled}>
      {inner}
    </button>
  );
}

function QrSheet({ b, due, paid, deposit, onClose }: { b: Booking; due: number; paid: number; deposit: number; onClose: () => void }) {
  const st = useStore((s) => s.ds.settings);
  const [which, setWhich] = useState<'deposit' | 'due'>(paid <= 0 && deposit < due ? 'deposit' : 'due');
  const amount = which === 'deposit' ? deposit : due;
  const payload = st.promptpayId ? promptpayPayload(st.promptpayId, amount) : null;
  const [img, setImg] = useState<string | null>(null);
  const key = `${payload}`;
  const last = useRef('');
  if (payload && last.current !== key) {
    last.current = key;
    void qrDataUrl(payload, 480).then(setImg);
  }
  const label = which === 'deposit' ? `ยอดมัดจำ ${b.depositPct}%` : 'ยอดคงเหลือ';

  async function send() {
    if (!img) return;
    // วาดการ์ด QR พร้อมยอดเงินเป็นรูป เพื่อแชร์เข้าแชท LINE
    const c = document.createElement('canvas');
    c.width = 720;
    c.height = 980;
    const g = c.getContext('2d')!;
    g.fillStyle = '#FFFFFF';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#1F2320';
    g.textAlign = 'center';
    g.font = '500 40px Mitr, sans-serif';
    g.fillText(st.homestay.name, 360, 80);
    g.font = '28px "IBM Plex Sans Thai", sans-serif';
    g.fillStyle = '#5E625E';
    g.fillText(`สแกนจ่ายด้วยพร้อมเพย์ · ${st.promptpayName || ''}`.trim(), 360, 128);
    const im = new Image();
    im.src = img;
    await im.decode();
    g.drawImage(im, 120, 160, 480, 480);
    g.fillStyle = '#5E625E';
    g.fillText(`${label} · ${b.name}`, 360, 700);
    g.fillStyle = '#1F2320';
    g.font = '600 64px "IBM Plex Sans Thai", sans-serif';
    g.fillText(fmtBaht(amount), 360, 780);
    g.font = '26px "IBM Plex Sans Thai", sans-serif';
    g.fillStyle = '#5E625E';
    g.fillText(`เข้าพัก ${fmtRange(b.checkIn, b.checkOut)}`, 360, 836);
    g.font = '34px Itim, cursive';
    g.fillStyle = '#2F4A3D';
    g.fillText('ไว้มาพบกันใหม่เน้อ', 360, 910);
    const blob = dataUrlToBlob(c.toDataURL('image/png'));
    const r = await shareFile(blob, `QR-${b.code || 'booking'}.png`, `${label} ${fmtBaht(amount)} — ${st.homestay.name}`);
    if (r === 'downloaded') toast('บันทึกรูป QR แล้ว ส่งรูปนี้ในแชท LINE ของลูกค้าได้เลย');
  }

  return (
    <Sheet onClose={onClose} label="QR พร้อมเพย์">
      <div className="heading center" style={{ fontSize: 20 }}>
        QR พร้อมเพย์
      </div>
      {deposit < due && paid <= 0 && <Chips value={which} onChange={setWhich} options={[{ v: 'deposit', label: `มัดจำ ${fmtBaht(deposit)}` }, { v: 'due', label: `เต็มจำนวน ${fmtBaht(due)}` }]} />}
      {!st.promptpayId ? (
        <div className="alert warn">ยังไม่ได้ใส่เลขพร้อมเพย์ของร้าน ไปที่ ตั้งค่า › การรับเงิน</div>
      ) : amount <= 0 ? (
        <div className="alert info">การจองนี้ชำระครบแล้ว</div>
      ) : (
        <>
          <div style={{ alignSelf: 'center', padding: 14, background: '#FFFFFF', borderRadius: 16, border: '1px solid #DDE1DC' }}>{img ? <img src={img} alt={`QR พร้อมเพย์ ${fmtBaht(amount)}`} width={220} height={220} /> : <div className="skeleton" style={{ width: 220, height: 220 }} />}</div>
          <div className="center" style={{ lineHeight: 1.4 }}>
            <div className="small muted">
              {label} · {b.name}
            </div>
            <div className="b num" style={{ fontSize: 28 }}>
              {fmtBaht(amount)}
            </div>
            {st.promptpayName && <div className="small muted">พร้อมเพย์ {st.promptpayName}</div>}
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => void send()}>
            <Send {...IC} />
            ส่งให้ลูกค้าทาง LINE
          </button>
        </>
      )}
    </Sheet>
  );
}

function PaySheet({ b, init, due, onClose }: { b: Booking; init: { kind: PaymentKind; amount: Satang }; due: number; onClose: () => void }) {
  const [kind, setKind] = useState<PaymentKind>(init.kind);
  const [amount, setAmount] = useState<Satang | null>(init.amount || null);
  const [method, setMethod] = useState<PayMethod>('transfer');
  const [paidOn, setPaidOn] = useState(todayISO());
  const [slip, setSlip] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const ok = !!amount && amount > 0;
  return (
    <Sheet onClose={onClose} label="บันทึกการรับเงิน">
      <div className="heading" style={{ fontSize: 20 }}>
        {kind === 'refund' ? 'บันทึกคืนเงิน' : 'บันทึกรับเงิน'}
      </div>
      <div className="small muted">
        {b.name} · คงเหลือ {fmtBaht(due)}
      </div>
      <Chips value={kind} onChange={setKind} options={(['deposit', 'balance', 'other', 'refund'] as PaymentKind[]).map((k) => ({ v: k, label: PAYMENT_KIND_LABEL[k] }))} />
      <label className="field">
        จำนวนเงิน (บาท)
        <MoneyInput value={amount} onChange={setAmount} ariaLabel="จำนวนเงิน" />
      </label>
      <div className="field">
        ช่องทาง
        <Chips value={method} onChange={setMethod} options={(['transfer', 'promptpay', 'cash'] as PayMethod[]).map((m) => ({ v: m, label: METHOD_LABEL[m] }))} />
      </div>
      <label className="field">
        วันที่ได้รับ
        <input className="input" type="date" value={paidOn} max={todayISO()} onChange={(e) => setPaidOn(e.target.value || todayISO())} />
      </label>
      {method !== 'cash' && (
        <>
          <input
            ref={ref}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) setSlip(await addImage(f));
            }}
          />
          <button type="button" className="dashed" onClick={() => (slip ? setSlip(null) : ref.current?.click())}>
            {slip ? (
              <span className="row ok" style={{ gap: 8 }}>
                <img src={fileUrl(slip)} alt="" className="thumb" style={{ width: 40, height: 40 }} />
                แนบสลิปแล้ว · แตะเพื่อเอาออก
              </span>
            ) : (
              <span className="row" style={{ gap: 8 }}>
                <Camera {...IC} />
                แนบสลิป (กล้อง / อัลบั้ม)
              </span>
            )}
          </button>
        </>
      )}
      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="หมายเหตุ (ไม่บังคับ)" aria-label="หมายเหตุ" />
      <button
        type="button"
        className="btn btn-accent btn-lg"
        disabled={!ok}
        onClick={() => {
          recordPayment(b, kind, amount!, method, slip, paidOn, note.trim());
          onClose();
        }}
      >
        บันทึก {ok ? fmtBaht(amount!) : ''}
      </button>
    </Sheet>
  );
}
