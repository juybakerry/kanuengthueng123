/** 11. หน้าจองออนไลน์ของลูกค้า — ภาพใหญ่ เล่าเรื่อง "กองไฟ บทเพลง มิตรภาพ" · วันว่าง (ว่าง/เต็ม เท่านั้น) · ส่งคำขอจอง */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { Stepper } from '../app/ui';
import { addDays, addMonths, dayOfWeek, daysInclusive, endOfMonth, fmtMonth, fmtRange, startOfMonth, TH_DAYS_SHORT, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import type { DepositMode, HomestayInfo } from '../domain/types';
import { depositRuleText } from '../domain/pricing';

interface Info {
  homestay: HomestayInfo;
  pricePerPerson: number;
  depositMode: DepositMode;
  depositPct: number;
  depositAmount: number;
  depositDueDays: number;
  checkInTime: string;
  checkOutTime: string;
  publicBooking: boolean;
  capacity: number;
  rooms: Array<{ name: string; kind: string; capacity: number }>;
  turnstileSiteKey: string;
}

const GALLERY: Array<[string, string]> = [
  ['mood-mountain-deck.jpg', 'วิวภูเขาจากชานไม้'],
  ['mood-mist.jpg', 'ทะเลหมอกยามเช้า'],
  ['mood-peak-sky.jpg', 'ยอดดอยและท้องฟ้า'],
  ['mood-campfire.jpg', 'กองไฟ บทเพลง มิตรภาพ'],
  ['mood-folk-night.jpg', 'ค่ำคืนดนตรีโฟล์ครอบกองไฟ'],
  ['mood-village.jpg', 'หมู่บ้านห้วยกุ๊บกั๊บ'],
];

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void }) => void };
  }
}

export function BookPage() {
  const today = todayISO();
  const [info, setInfo] = useState<Info | null>(null);
  const [days, setDays] = useState<Map<string, { free: number; closed: boolean }>>(new Map());
  const [month, setMonth] = useState(startOfMonth(today));
  const [checkIn, setCheckIn] = useState<string | null>(null);
  const [checkOut, setCheckOut] = useState<string | null>(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', lineId: '', message: '', website: '' });
  const [consent, setConsent] = useState(false);
  const [quote, setQuote] = useState<{ total: number; deposit: number } | null>(null);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const tsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = 'mist';
    void api<Info>('/api/public/info').then((i) => {
      setInfo(i);
      document.title = `${i.homestay.name} — จองที่พัก`;
    });
  }, []);
  useEffect(() => {
    const from = month < today ? today : month;
    void api<{ days: Array<{ date: string; free: number; closed: boolean }> }>(`/api/public/availability?from=${from}&days=${Math.max(1, Math.round((Date.parse(endOfMonth(month)) - Date.parse(from)) / 86400000) + 2)}`).then((r) =>
      setDays((m) => {
        const n = new Map(m);
        for (const d of r.days) n.set(d.date, d);
        return n;
      }),
    );
  }, [month, today]);
  useEffect(() => {
    if (!checkIn || !checkOut) return setQuote(null);
    void api<{ total: number; deposit: number }>('/api/public/quote', { body: { checkIn, checkOut, adults, children } }).then(setQuote).catch(() => setQuote(null));
  }, [checkIn, checkOut, adults, children]);
  useEffect(() => {
    if (!info?.turnstileSiteKey || !tsRef.current) return;
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.onload = () => window.turnstile?.render(tsRef.current!, { sitekey: info.turnstileSiteKey, callback: setToken });
    document.head.appendChild(s);
  }, [info?.turnstileSiteKey]);

  const nights = checkIn && checkOut ? daysInclusive(checkIn, addDays(checkOut, -1)) : [];
  const guests = adults + children;
  const free = nights.length ? Math.min(...nights.map((d) => days.get(d)?.free ?? 0)) : (info?.capacity ?? 24);
  const over = nights.length > 0 && guests > free;
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const cells = daysInclusive(addDays(first, -dayOfWeek(first)), addDays(last, 6 - dayOfWeek(last)));
  const ok = !!checkIn && !!checkOut && !over && form.name.trim() && form.phone.replace(/\D/g, '').length >= 9 && consent && (!info?.turnstileSiteKey || token);

  function pick(d: string) {
    if (!checkIn || checkOut || d <= checkIn) {
      setCheckIn(d);
      setCheckOut(null);
    } else setCheckOut(d);
  }

  async function submit() {
    if (!ok) return;
    setBusy(true);
    setErr('');
    try {
      await api('/api/public/request', { body: { ...form, checkIn, checkOut, adults, children, turnstile: token } });
      setSent(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'ส่งไม่สำเร็จ ลองอีกครั้งเน้อ');
    } finally {
      setBusy(false);
    }
  }

  const h = info?.homestay;
  return (
    <div className="pub">
      <nav className="pub-nav">
        <img src="/assets/logo-mark.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
        <span className="heading" style={{ fontSize: 20, flex: 1 }}>
          {h?.shortName ?? 'คะนึงถึง'}
        </span>
        <a href="#story" className="tablet-only">เรื่องของเรา</a>
        <a href="#gallery" className="tablet-only">บรรยากาศ</a>
        <a href="#book" className="btn btn-accent btn-sm" style={{ color: 'var(--color-on-accent)' }}>
          ดูวันว่าง
        </a>
      </nav>
      <header className="pub-hero">
        <span className="hand" style={{ fontSize: 22, opacity: 0.95 }}>
          กองไฟ บทเพลง มิตรภาพ
        </span>
        <h1>{h?.name ?? 'คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์'}</h1>
        <p style={{ fontSize: 'clamp(17px, 2vw, 21px)', maxWidth: 640, margin: '12px 0 0' }}>{h?.tagline || 'โฮมสเตย์เล็ก ๆ สำหรับคนที่อยากหนีความวุ่นวายมาพักผ่อน'}</p>
        <div className="pub-facts">
          <span>{info ? `${fmtBaht(info.pricePerPerson)} / คน / คืน · รวมอาหาร 1 มื้อ` : '…'}</span>
          <span>{info ? `${info.rooms.length} ห้อง · รับได้ ${info.capacity} คน` : '…'}</span>
          <span>{h?.address || 'อ.แม่แตง จ.เชียงใหม่'}</span>
        </div>
      </header>

      <section id="story" className="pub-section grid-2" style={{ alignItems: 'center', gap: 32 }}>
        <div className="col gap12">
          <h2>เช้ามีทะเลหมอก ค่ำมีกองไฟ</h2>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.8 }}>บ้านไม้บนดอยที่ห้วยกุ๊บกั๊บ ตื่นมาเจอวิวภูเขาจากชานไม้ ตกค่ำนั่งล้อมวงรอบกองไฟ เล่นดนตรีโฟล์คกับเพื่อนใหม่ ราคานี้รวมที่พักและอาหาร 1 มื้อ เด็กคิดราคาเท่าผู้ใหญ่ มีรถรับส่งให้โดยไม่เก็บเพิ่ม</p>
          <div className="grid-2" style={{ gap: 12 }}>
            <div className="card">
              <span className="small muted">เช็คอิน / เช็คเอาท์</span>
              <span className="b" style={{ fontSize: 20 }}>
                {info ? `${info.checkInTime} / ${info.checkOutTime}` : '…'}
              </span>
            </div>
            <div className="card">
              <span className="small muted">ห้องพัก</span>
              <span className="b" style={{ fontSize: 18 }}>
                {info ? info.rooms.map((r) => `${r.name} (${r.capacity})`).join(' · ') : '…'}
              </span>
            </div>
          </div>
        </div>
        <img src="/assets/mood-mountain-deck.jpg" alt="วิวภูเขาจากชานไม้" style={{ width: '100%', borderRadius: 16, aspectRatio: '4/3', objectFit: 'cover' }} />
      </section>

      <section id="gallery" className="pub-gallery">
        <div className="pub-section">
          <h2>บรรยากาศที่คะนึงถึง</h2>
          <div className="grid">
            {GALLERY.map(([f, l]) => (
              <figure key={f}>
                <img src={`/assets/${f}`} alt={l} loading="lazy" />
                <figcaption>{l}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section id="book" className="pub-section">
        <h2>ดูวันว่าง และส่งคำขอจอง</h2>
        {info && !info.publicBooking ? (
          <div className="alert info">ตอนนี้ยังไม่เปิดรับจองออนไลน์ ติดต่อเราทาง {h?.lineId ? `LINE ${h.lineId}` : 'LINE'} {h?.phone ? `หรือโทร ${h.phone}` : ''} ได้เลยเน้อ</div>
        ) : sent ? (
          <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: 32, animation: 'mistIn 500ms var(--ease)' }}>
            <Flame size={32} color="#E8893A" />
            <div className="hand" style={{ fontSize: 30 }}>
              ได้รับคำขอแล้วเน้อ
            </div>
            <div>
              {fmtRange(checkIn!, checkOut!)} · {guests} คน — เราจะติดต่อกลับทาง {form.lineId ? 'LINE' : 'โทรศัพท์'} เพื่อยืนยันและแจ้งยอดมัดจำ
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => { setSent(false); setCheckIn(null); setCheckOut(null); }}>
              ส่งคำขออีกครั้ง
            </button>
          </div>
        ) : (
          <div className="grid-2" style={{ gap: 24 }}>
            <div className="card">
              <div className="row gap8">
                <button type="button" className="icon-btn plain" aria-label="เดือนก่อน" disabled={month <= startOfMonth(today)} onClick={() => setMonth(addMonths(month, -1))}>
                  <ChevronLeft size={20} />
                </button>
                <span className="heading grow center" style={{ fontSize: 18 }}>
                  {fmtMonth(month.slice(0, 7))}
                </span>
                <button type="button" className="icon-btn plain" aria-label="เดือนถัดไป" disabled={month >= addMonths(startOfMonth(today), 3)} onClick={() => setMonth(addMonths(month, 1))}>
                  <ChevronRight size={20} />
                </button>
              </div>
              <div className="pub-cal">
                {TH_DAYS_SHORT.map((d) => (
                  <div key={d} className="cal-dow">
                    {d}
                  </div>
                ))}
                {cells.map((d) => {
                  if (d < first || d > last) return <span key={d} />;
                  const a = days.get(d);
                  const past = d < today;
                  const full = !!a && (a.free <= 0 || a.closed);
                  const low = !!a && !full && a.free <= 6;
                  const isEnd = d === checkIn || d === checkOut;
                  const mid = checkIn && checkOut && d > checkIn && d < checkOut;
                  const canPick = !past && (!full || (checkIn && !checkOut && d > checkIn));
                  return (
                    <button key={d} type="button" disabled={!canPick} className={isEnd ? 'end' : mid ? 'mid' : full ? 'full' : low ? 'low' : ''} onClick={() => pick(d)} aria-label={`${d} ${full ? 'เต็ม' : `ว่าง ${a?.free ?? ''} ที่`}`}>
                      <span className="b num">{Number(d.slice(8))}</span>
                      <span className="xs num">{past ? '' : !a ? '' : full ? 'เต็ม' : a.free}</span>
                    </button>
                  );
                })}
              </div>
              <div className="legend">
                <span><i style={{ background: 'var(--color-surface)', border: '1px solid var(--color-surface-2)' }} />ว่าง (ตัวเลข = ที่ว่าง)</span>
                <span><i style={{ background: '#E9DDBA' }} />เหลือน้อย</span>
                <span><i style={{ background: '#F4DCD6' }} />เต็ม</span>
              </div>
              <div className="b">{!checkIn ? 'แตะวันเข้าพัก' : !checkOut ? 'แตะวันที่ออก' : `${fmtRange(checkIn, checkOut)} · ${nights.length} คืน`}</div>
            </div>
            <div className="card">
              <Stepper label="ผู้ใหญ่" value={adults} min={1} max={info?.capacity ?? 24} onChange={setAdults} />
              <Stepper label="เด็ก" desc="คิดราคาเท่าผู้ใหญ่" value={children} min={0} max={info?.capacity ?? 24} onChange={setChildren} />
              {over && <div className="alert">ช่วงนี้รับได้อีก {free} คน ลองลดจำนวนคนหรือเลือกวันอื่นเน้อ</div>}
              <input className="input" placeholder="ชื่อผู้จอง / ชื่อกลุ่ม" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-label="ชื่อผู้จอง" autoComplete="name" />
              <input className="input" placeholder="เบอร์โทรศัพท์" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} aria-label="เบอร์โทรศัพท์" autoComplete="tel" />
              <input className="input" placeholder="LINE ID" value={form.lineId} onChange={(e) => setForm({ ...form, lineId: e.target.value })} aria-label="LINE ID" />
              <textarea className="textarea" placeholder="อาหารที่แพ้ / ต้องการรถรับส่งจากที่ไหน (ไม่บังคับ)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} aria-label="ข้อความถึงโฮมสเตย์" />
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} style={{ position: 'absolute', left: -9999, width: 1, height: 1 }} aria-hidden />
              {quote && (
                <div className="row between divider" style={{ paddingTop: 10 }}>
                  <span className="muted">ราคาประมาณ ({guests} คน × {nights.length} คืน)</span>
                  <span className="b num" style={{ fontSize: 20 }}>
                    {fmtBaht(quote.total)}
                  </span>
                </div>
              )}
              {quote && quote.deposit > 0 && (
                <div className="row between small" style={{ marginTop: -6 }}>
                  <span className="muted">มัดจำหลังยืนยันการจอง</span>
                  <span className="b num">{fmtBaht(quote.deposit)}</span>
                </div>
              )}
              <label className="row small" style={{ gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 20, height: 20, marginTop: 3, flex: 'none' }} />
                <span>ยินยอมให้โฮมสเตย์เก็บชื่อ เบอร์โทร และ LINE ID เพื่อติดต่อยืนยันการจองเท่านั้น (ขอลบข้อมูลได้ทุกเมื่อ)</span>
              </label>
              <div ref={tsRef} />
              {err && <div className="alert">{err}</div>}
              <button type="button" className="btn btn-accent btn-lg" disabled={!ok || busy} onClick={() => void submit()}>
                {busy ? 'กำลังส่ง…' : 'ส่งคำขอจอง'}
              </button>
              <div className="small muted">
                {info ? depositRuleText(info, fmtBaht) : 'มัดจำ'} ภายใน {info?.depositDueDays ?? 3} วันหลังยืนยัน (โอนธนาคาร / พร้อมเพย์) · ส่วนที่เหลือชำระวันเข้าพัก · ยกเลิกไม่คืนมัดจำ · เลื่อนวันได้ 1 ครั้ง
              </div>
            </div>
          </div>
        )}
      </section>

      <footer className="pub-foot">
        <img src="/assets/logo-mark.png" alt="" width={48} height={48} style={{ borderRadius: 12 }} />
        <div className="heading" style={{ fontSize: 20, marginTop: 8 }}>
          {h?.name ?? 'คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์'}
        </div>
        <div>{h?.address}</div>
        {h?.facebook && <div>Facebook: {h.facebook}</div>}
        {h?.instagram && <div>Instagram: {h.instagram}</div>}
        {h?.lineId && <div>LINE: {h.lineId}</div>}
        {h?.phone && <div>โทร {h.phone}</div>}
        <div className="hand" style={{ fontSize: 22, marginTop: 12 }}>
          ไว้มาพบกันใหม่เน้อ
        </div>
      </footer>
    </div>
  );
}
