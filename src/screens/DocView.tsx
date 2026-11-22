/** 10. ใบยืนยันการจอง / ใบเสร็จ — ขาวดำพิมพ์ได้ · บันทึก PDF · ส่งรูปทาง LINE ผ่านเมนูแชร์ของเครื่อง (FR-08) */
import { useEffect, useRef, useState } from 'react';
import { Download, Printer, Send } from 'lucide-react';
import { toJpeg, toPng } from 'html-to-image';
import { useStore, save } from '../lib/store';
import { close } from '../app/nav';
import { viewOf, roomNames } from '../app/derive';
import { CloseBtn, IC, Seg, toast, useEscape } from '../app/ui';
import { qrDataUrl, shareFile, jpegToPdf, dataUrlToBlob } from '../lib/share';
import { fmtDate, fmtRange, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { promptpayPayload } from '../domain/promptpay';
import { METHOD_LABEL } from '../domain/defaults';

export function DocView({ id, kind: initKind }: { id: string; kind: 'confirm' | 'receipt' }) {
  const ds = useStore((s) => s.ds);
  const b = ds.bookings.find((x) => x.id === id);
  const [kind, setKind] = useState(initKind);
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEscape(close);
  const v = b ? viewOf(b, ds.payments) : null;
  const st = ds.settings;
  const qrAmount = v ? (v.paid <= 0 ? v.deposit : v.due) : 0;
  const payload = st.promptpayId && qrAmount > 0 ? promptpayPayload(st.promptpayId, qrAmount) : null;
  useEffect(() => {
    if (payload) void qrDataUrl(payload, 360).then(setQr);
    else setQr(null);
  }, [payload]);
  if (!b || !v) return null;

  const isReceipt = kind === 'receipt';
  const no = `${isReceipt ? 'RC' : 'BK'}-${b.code.replace(/^KT-/, '') || 'รอเลขที่'}`;
  const methods = [...new Set(v.payments.filter((p) => p.kind !== 'refund').map((p) => METHOD_LABEL[p.method]))].join(', ');
  const uniform = b.nightly.length > 0 && b.nightly.every((n) => n.price === b.nightly[0]!.price);
  const lodging = b.nightly.reduce((s, n) => s + n.price * v.guests, 0);
  const statusText = v.pay === 'paid' ? 'ชำระครบ' : v.pay === 'deposit' ? 'ชำระมัดจำแล้ว' : 'รอชำระ';
  const fileBase = `${isReceipt ? 'ใบเสร็จ' : 'ใบยืนยัน'}-${b.code || b.name}`;

  async function render(fmt: 'png' | 'jpeg') {
    const el = ref.current!;
    const opts = { pixelRatio: 2, backgroundColor: '#FFFFFF', cacheBust: false, style: { borderRadius: '0', boxShadow: 'none', margin: '0' } };
    return fmt === 'png' ? toPng(el, opts) : toJpeg(el, { ...opts, quality: 0.92 });
  }

  async function savePdf() {
    setBusy(true);
    try {
      const url = await render('jpeg');
      const img = new Image();
      img.src = url;
      await img.decode();
      const bytes = new Uint8Array(await dataUrlToBlob(url).arrayBuffer());
      const pdf = jpegToPdf(bytes, img.naturalWidth, img.naturalHeight);
      const r = await shareFile(pdf, `${fileBase}.pdf`, `${isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบยืนยันการจอง'} ${st.homestay.name}`);
      if (r === 'downloaded') toast('บันทึกไฟล์ PDF แล้ว');
      else if (r === 'shared') logSent('PDF');
    } catch (e) {
      console.error(e);
      toast('สร้าง PDF ไม่สำเร็จ ลองใช้ปุ่มพิมพ์แทน', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  async function sendImage() {
    setBusy(true);
    try {
      const url = await render('png');
      const r = await shareFile(dataUrlToBlob(url), `${fileBase}.png`, `${isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบยืนยันการจอง'} ${st.homestay.name} · ไว้มาพบกันใหม่เน้อ`);
      if (r === 'downloaded') toast('บันทึกรูปแล้ว ส่งรูปนี้ในแชท LINE ของลูกค้าได้เลย');
      if (r !== 'cancel') logSent('รูป');
    } catch (e) {
      console.error(e);
      toast('สร้างรูปไม่สำเร็จ ลองใหม่อีกครั้ง', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  function logSent(what: string) {
    save('bookings', b!, { summary: `ส่ง${isReceipt ? 'ใบเสร็จ' : 'ใบยืนยัน'}ให้ลูกค้า (${what})` });
  }

  return (
    <section className="overlay" style={{ zIndex: 50 }} aria-label="เอกสารส่งลูกค้า">
      <div className="overlay-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: '8px 16px 12px' }}>
        <div className="row gap8">
          <h1 style={{ flex: 1, fontSize: 24 }}>เอกสารส่งลูกค้า</h1>
          <CloseBtn onClick={close} />
        </div>
        <Seg
          value={kind}
          onChange={(k) => (k === 'receipt' && v.paid <= 0 ? toast('ยังไม่มีการรับเงิน จึงยังออกใบเสร็จไม่ได้', { kind: 'error' }) : setKind(k))}
          options={[
            { v: 'confirm', label: 'ใบยืนยันการจอง' },
            { v: 'receipt', label: <span style={{ opacity: v.paid > 0 ? 1 : 0.45 }}>ใบเสร็จ</span> },
          ]}
        />
      </div>
      <div className="overlay-body">
        <article ref={ref} className="doc">
          <div className="row-top between" style={{ gap: 16 }}>
            <img src="/assets/logo-full.jpg" alt="คะนึงถึง ห้วยกุ๊บกั๊บ" width={72} height={86} style={{ objectFit: 'contain', filter: 'grayscale(1)' }} />
            <div className="right" style={{ lineHeight: 1.45 }}>
              <div className="heading" style={{ fontSize: 22 }}>
                {isReceipt ? 'ใบเสร็จรับเงิน' : 'ใบยืนยันการจอง'}
              </div>
              <div className="muted">เลขที่ {no}</div>
              <div className="muted">วันที่ออก {fmtDate(todayISO())}</div>
            </div>
          </div>
          <div style={{ lineHeight: 1.5 }}>
            <div className="b" style={{ fontSize: 15 }}>
              {st.homestay.name}
            </div>
            <div className="muted">
              {[st.homestay.address, st.homestay.phone && `โทร ${st.homestay.phone}`, st.homestay.lineId && `LINE ${st.homestay.lineId}`, st.homestay.facebook && `Facebook: ${st.homestay.facebook}`, st.homestay.instagram && `IG: ${st.homestay.instagram}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, padding: '14px 0', borderTop: '1px solid #DDE1DC', borderBottom: '1px solid #DDE1DC' }}>
            <div>
              <div className="muted">ผู้จอง</div>
              <div className="b" style={{ fontSize: 15 }}>
                {b.name}
              </div>
              <div>
                {b.phone || '–'}
                {b.lineId ? ` · LINE ${b.lineId}` : ''}
              </div>
            </div>
            <div>
              <div className="muted">วันเข้าพัก</div>
              <div className="b" style={{ fontSize: 15 }}>
                {fmtRange(b.checkIn, b.checkOut)}
              </div>
              <div>{v.nights} คืน</div>
            </div>
            <div>
              <div className="muted">ห้องพัก</div>
              <div className="b">{roomNames(b, ds)}</div>
            </div>
            <div>
              <div className="muted">ผู้เข้าพัก</div>
              <div className="b">
                ผู้ใหญ่ {b.adults}
                {b.children ? ` · เด็ก ${b.children}` : ''} · รวม {v.guests} คน
              </div>
            </div>
          </div>
          <div className="col">
            <div className="row between muted" style={{ paddingBottom: 6, borderBottom: '1.5px solid #1F2320' }}>
              <span>รายการ</span>
              <span>จำนวนเงิน</span>
            </div>
            <DocRow l="ค่าที่พัก (รวมอาหาร 1 มื้อ)" d={uniform ? `${fmtBaht(b.nightly[0]!.price)} × ${v.guests} คน × ${v.nights} คืน` : b.nightly.map((n) => `${fmtDate(n.date, { year: false })} ${fmtBaht(n.price)}`).join(' · ') + ` × ${v.guests} คน`} v={fmtBaht(lodging)} />
            {b.usesTransport && <DocRow l="รถรับส่ง ไป–กลับ" d={`${b.pickupPoint || 'จุดนัดรับ'}${b.pickupTime ? ` · ${b.pickupTime}` : ''}`} v="รวมแล้ว" />}
            {b.extra > 0 && <DocRow l="รายการเพิ่ม" d={b.extraNote} v={fmtBaht(b.extra)} />}
            {b.discount > 0 && <DocRow l="ส่วนลด" d={b.extraNote} v={`−${fmtBaht(b.discount)}`} />}
            <div className="row between" style={{ padding: '10px 0 4px', fontSize: 15 }}>
              <span className="b">ยอดรวม</span>
              <span className="b num">{fmtBaht(b.total)}</span>
            </div>
            {v.paid > 0 && (
              <div className="row between" style={{ padding: '2px 0' }}>
                <span className="muted">ชำระแล้ว ({methods})</span>
                <span className="num">{fmtBaht(v.paid)}</span>
              </div>
            )}
            {isReceipt &&
              v.payments.map((p) => (
                <div key={p.id} className="row between small muted" style={{ padding: '0 0 0 12px' }}>
                  <span>
                    {fmtDate(p.paidOn)} · {METHOD_LABEL[p.method]}
                    {p.kind === 'refund' ? ' (คืนเงิน)' : ''}
                  </span>
                  <span className="num">
                    {p.kind === 'refund' ? '−' : ''}
                    {fmtBaht(p.amount)}
                  </span>
                </div>
              ))}
            <div className="row between" style={{ padding: '2px 0' }}>
              <span className="muted">คงเหลือ</span>
              <span className="b num">{fmtBaht(v.due)}</span>
            </div>
            <div style={{ marginTop: 8, alignSelf: 'flex-start', padding: '2px 12px', border: '1.5px solid #1F2320', borderRadius: 999, fontWeight: 600 }}>สถานะ: {statusText}</div>
          </div>
          {!isReceipt && qr && (
            <div className="row" style={{ gap: 16, padding: 14, border: '1px solid #DDE1DC', borderRadius: 8 }}>
              <img src={qr} alt="QR พร้อมเพย์" width={112} height={112} />
              <div style={{ lineHeight: 1.5 }}>
                <div className="b">สแกนจ่ายด้วยพร้อมเพย์{st.promptpayName ? ` · ${st.promptpayName}` : ''}</div>
                <div className="b num" style={{ fontSize: 20 }}>
                  {fmtBaht(qrAmount)}
                </div>
                <div className="muted">{v.paid <= 0 ? `มัดจำ ${fmtBaht(v.deposit)} ภายใน ${fmtDate(b.depositDueOn)}` : `ส่วนที่เหลือ ชำระวันเข้าพัก ${fmtDate(b.checkIn)}`}</div>
              </div>
            </div>
          )}
          {!isReceipt && st.bankAccount && <div className="muted">โอนเข้าบัญชี: {st.bankAccount}</div>}
          {b.allergies && (
            <div>
              <span className="muted">ความต้องการพิเศษ: </span>
              {b.allergies}
            </div>
          )}
          <div className="muted" style={{ lineHeight: 1.6 }}>
            เช็คอิน {st.checkInTime} · เช็คเอาท์ {st.checkOutTime} · ราคารวมที่พักและอาหาร 1 มื้อ · ยกเลิกการจองไม่คืนมัดจำ · เลื่อนวันได้ {st.rescheduleLimit} ครั้ง
          </div>
          <div className="hand center" style={{ paddingTop: 14, borderTop: '1px solid #DDE1DC', fontSize: 20, lineHeight: 1.5 }}>
            ขอบคุณที่มาพักผ่อน ไว้มาพบกันใหม่เน้อ
          </div>
        </article>
      </div>
      <div className="overlay-foot">
        <div className="inner">
          <button type="button" className="btn btn-ghost" aria-label="พิมพ์" onClick={() => window.print()} style={{ padding: '0 14px' }}>
            <Printer {...IC} />
          </button>
          <button type="button" className="btn btn-secondary grow" disabled={busy} onClick={() => void savePdf()}>
            <Download {...IC} />
            บันทึก PDF
          </button>
          <button type="button" className="btn btn-primary grow" style={{ flexGrow: 1.4 }} disabled={busy} onClick={() => void sendImage()}>
            <Send {...IC} />
            ส่งทาง LINE
          </button>
        </div>
      </div>
    </section>
  );
}

function DocRow({ l, d, v }: { l: string; d?: string; v: string }) {
  return (
    <div className="row between" style={{ gap: 12, padding: '10px 0', borderBottom: '1px solid #DDE1DC', alignItems: 'flex-start' }}>
      <span>
        <span className="b" style={{ display: 'block' }}>
          {l}
        </span>
        {d && <span className="muted">{d}</span>}
      </span>
      <span className="b num nowrap">{v}</span>
    </div>
  );
}
