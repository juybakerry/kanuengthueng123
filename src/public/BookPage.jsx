import { useEffect, useMemo, useState } from 'react';
import { add, addM, diff, fD, fDY, fMY, pd, baht, nightsOf, calcTotal, DOW } from '../lib/core.js';

async function getJson(url, opts) {
  const r = await fetch(url, opts);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
  return d;
}

function MonthGrid({ info, month, ci, co, onPick }) {
  const f = month.slice(0, 8) + '01', dw = pd(f).getUTCDay(), dim = diff(f, addM(f, 1));
  const cells = [];
  for (let i = 0; i < dw; i++) cells.push(null);
  for (let i = 0; i < dim; i++) cells.push(add(f, i));
  return (
    <div className="pub-cal">
      {DOW.map(d => <div key={d} className="pub-dow">{d}</div>)}
      {cells.map((d, i) => {
        if (!d) return <div key={'x' + i} />;
        const left = info.days[d];
        const off = left != null && left <= 0;
        const inStay = ci && co && d >= ci && d < co;
        const edge = d === ci || d === co;
        return (
          <button
            key={d}
            type="button"
            disabled={left == null}
            aria-label={`${fD(d)} ${left == null ? 'จองไม่ได้' : left <= 0 ? 'เต็ม' : `ว่าง ${left} ที่`}`}
            aria-pressed={!!edge}
            className={'pub-day' + (off ? ' is-full' : '') + (inStay ? ' is-in' : '') + (edge ? ' is-edge' : '')}
            onClick={() => onPick(d)}
          >
            <span className="n">{pd(d).getUTCDate()}</span>
            <span className="l">{left == null ? '' : left <= 0 ? 'เต็ม' : `ว่าง ${left}`}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BookPage() {
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState('');
  const [month, setMonth] = useState('');
  const [f, setF] = useState({ name: '', phone: '', line: '', checkIn: '', checkOut: '', adults: 2, children: 0, transfer: false, pickupPlace: '', pickupTime: '', allergy: '', note: '' });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    getJson('/api/public/info').then(d => { setInfo(d); setMonth(d.today); }).catch(e => setErr(e.message));
  }, []);

  const set = k => e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setF(x => ({ ...x, [k]: v })); };

  // Tap check-in, then check-out on the calendar.
  const pick = d => setF(x => {
    if (!x.checkIn || x.checkOut || d <= x.checkIn) return { ...x, checkIn: d, checkOut: '' };
    return { ...x, checkOut: d };
  });

  const g = (+f.adults || 0) + (+f.children || 0);
  const check = useMemo(() => {
    if (!info) return { ok: false };
    const E = [];
    const valid = f.checkIn && f.checkOut && f.checkIn < f.checkOut;
    if (!f.checkIn) E.push('เลือกวันเข้าพัก');
    else if (!f.checkOut) E.push('เลือกวันออก');
    else if (!valid) E.push('วันออกต้องอยู่หลังวันเข้าพัก');
    if ((+f.adults || 0) < 1) E.push('ผู้ใหญ่อย่างน้อย 1 คน');
    if (valid) {
      if (diff(f.checkIn, f.checkOut) > 30) E.push('จองได้ไม่เกิน 30 คืน');
      for (const n of nightsOf(f)) {
        const left = info.days[n];
        if (left == null || left < g) { E.push(`คืนวันที่ ${fD(n)} ว่าง ${left || 0} ที่ ไม่พอสำหรับ ${g} คน`); break; }
      }
    }
    const t = valid && g > 0 ? calcTotal(f.checkIn, f.checkOut, g, info) : null;
    return { ok: !E.length, errors: E, t, valid };
  }, [info, f, g]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    if (!f.name.trim()) return setErr('กรุณากรอกชื่อ');
    if (f.phone.replace(/\D/g, '').length < 9) return setErr('กรุณากรอกเบอร์โทรศัพท์');
    setSending(true);
    try {
      const r = await getJson('/api/public/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      setDone({ ...r, ...f });
    } catch (x) {
      setErr(x.message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <section className="pub-card">
        <h2 className="pub-title">ส่งคำขอจองแล้ว</h2>
        <p>ขอบคุณคุณ{done.name.replace(/^คุณ/, '')} ทางร้านจะติดต่อกลับทางโทรศัพท์หรือ LINE เพื่อยืนยันห้องพักและแจ้งยอดมัดจำ</p>
        <div className="pub-sum">
          <div>{fD(done.checkIn)} – {fDY(done.checkOut)} · {diff(done.checkIn, done.checkOut)} คืน · {(+done.adults || 0) + (+done.children || 0)} คน</div>
          <div>ราคาประมาณ <strong>{baht(done.estimate)}</strong> บาท</div>
          <div className="muted-12">เลขที่คำขอ {done.id}</div>
        </div>
      </section>
    );
  }
  if (!info) return <section className="pub-card">{err || 'กำลังโหลด…'}</section>;

  const minMonth = info.today.slice(0, 7), maxMonth = add(info.today, 179).slice(0, 7);
  return (
    <form className="pub-card stack-16" onSubmit={submit}>
      <div>
        <h2 className="pub-title">จองที่พักออนไลน์</h2>
        <div className="muted-12">
          {baht(info.price)} บาท / คน / คืน รวมอาหาร 1 มื้อ · เด็กคิดเท่าผู้ใหญ่ · มัดจำ 50% ภายใน {info.depositDays} วัน
          {info.group.pct > 0 ? ` · ${info.group.min} คนขึ้นไปลด ${info.group.pct}%` : ''} · เช็คอิน {info.checkInTime} เช็คเอาท์ {info.checkOutTime}
        </div>
      </div>

      <div className="stack-8">
        <div className="row-between" style={{ alignItems: 'center' }}>
          <button type="button" className="btn btn-secondary btn-icon" disabled={month.slice(0, 7) <= minMonth} onClick={() => setMonth(addM(month, -1))} aria-label="เดือนก่อน">‹</button>
          <strong>{fMY(month)}</strong>
          <button type="button" className="btn btn-secondary btn-icon" disabled={month.slice(0, 7) >= maxMonth} onClick={() => setMonth(addM(month, 1))} aria-label="เดือนถัดไป">›</button>
        </div>
        <MonthGrid info={info} month={month} ci={f.checkIn} co={f.checkOut} onPick={pick} />
        <div className="muted-12">แตะวันเข้าพัก แล้วแตะวันออก · ตัวเลข = จำนวนที่ว่างคืนนั้น (รวมทั้งหมด {info.cap} ที่)</div>
      </div>

      <div className="grid-2">
        <label className="field"><span className="field-label">วันเข้าพัก</span><input className="input" type="date" min={info.today} value={f.checkIn} onChange={set('checkIn')} required /></label>
        <label className="field"><span className="field-label">วันออก</span><input className="input" type="date" min={f.checkIn || info.today} value={f.checkOut} onChange={set('checkOut')} required /></label>
        <label className="field"><span className="field-label">ผู้ใหญ่</span><input className="input" type="number" min="1" max="24" value={f.adults} onChange={set('adults')} /></label>
        <label className="field"><span className="field-label">เด็ก</span><input className="input" type="number" min="0" max="23" value={f.children} onChange={set('children')} /></label>
        <label className="field span-all"><span className="field-label">ชื่อผู้จอง / ชื่อกลุ่ม</span><input className="input" value={f.name} onChange={set('name')} required maxLength={100} autoComplete="name" /></label>
        <label className="field"><span className="field-label">เบอร์โทรศัพท์</span><input className="input" type="tel" value={f.phone} onChange={set('phone')} required maxLength={30} autoComplete="tel" /></label>
        <label className="field"><span className="field-label">LINE ID (ถ้ามี)</span><input className="input" value={f.line} onChange={set('line')} maxLength={60} /></label>
        <label className="row-10 span-all" style={{ cursor: 'pointer' }}>
          <input type="checkbox" className="check" checked={f.transfer} onChange={set('transfer')} />
          <span>ต้องการรถรับส่ง (ไป–กลับ ฟรี)</span>
        </label>
        {f.transfer && (
          <>
            <label className="field"><span className="field-label">จุดรับ</span><input className="input" value={f.pickupPlace} onChange={set('pickupPlace')} placeholder="เช่น สถานีขนส่ง" maxLength={120} /></label>
            <label className="field"><span className="field-label">เวลาที่ถึงโดยประมาณ</span><input className="input" type="time" value={f.pickupTime} onChange={set('pickupTime')} /></label>
          </>
        )}
        <label className="field span-all"><span className="field-label">อาหารที่แพ้ / ความต้องการพิเศษ</span><textarea className="input" style={{ minHeight: 60 }} value={f.allergy} onChange={set('allergy')} maxLength={300} /></label>
        <label className="field span-all"><span className="field-label">ข้อความถึงร้าน</span><textarea className="input" style={{ minHeight: 60 }} value={f.note} onChange={set('note')} maxLength={500} /></label>
      </div>

      <div className="pub-sum">
        {check.t ? (
          <>
            {check.t.lines.map(l => <div key={l.label} className="row-between"><span>{l.label}</span><span>{l.amt}</span></div>)}
            {check.t.disc > 0 && <div className="row-between"><span>ส่วนลดกลุ่ม</span><span>−{baht(check.t.disc)}</span></div>}
            <div className="row-between pub-total"><strong>ราคาประมาณ</strong><strong>{baht(check.t.total)} บาท</strong></div>
            <div className="muted-12">มัดจำ 50% = {baht(check.t.total / 2)} บาท · ร้านจะยืนยันยอดอีกครั้ง</div>
          </>
        ) : <div className="muted-12">เลือกวันเพื่อดูราคา</div>}
      </div>

      {(check.errors && check.errors.length > 0 && check.valid) && <div className="alert">{check.errors.join(' · ')}</div>}
      {err && <div className="alert">{err}</div>}
      <button className="btn btn-primary" type="submit" disabled={!check.ok || sending} style={{ justifyContent: 'flex-start' }}>
        {sending ? 'กำลังส่ง…' : 'ส่งคำขอจอง'}
      </button>
    </form>
  );
}
