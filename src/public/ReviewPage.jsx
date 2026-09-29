import { useEffect, useState } from 'react';
import { fD, fDY } from '../lib/core.js';

export default function ReviewPage({ token }) {
  const [b, setB] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) return;
    fetch('/api/public/booking/' + encodeURIComponent(token)).then(r => (r.ok ? r.json() : null)).then(setB).catch(() => {});
  }, [token]);

  async function submit(e) {
    e.preventDefault();
    if (!rating) return setErr('กรุณาเลือกจำนวนดาว');
    setState('sending');
    setErr('');
    const r = await fetch('/api/public/review', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, rating, comment, name }),
    }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (r && r.ok) setState('done');
    else { setState(''); setErr(d.error || 'ส่งไม่สำเร็จ กรุณาลองใหม่'); }
  }

  if (state === 'done') {
    return <section className="pub-card"><h2 className="pub-title">ขอบคุณสำหรับความคิดเห็น 🙏</h2><p>หวังว่าจะได้ต้อนรับอีกครั้งที่คะนึงถึงโฮมสเตย์</p></section>;
  }
  return (
    <form className="pub-card stack-16" onSubmit={submit}>
      <div>
        <h2 className="pub-title">แบบประเมินความพึงพอใจ</h2>
        {b ? <div className="muted-12">คุณ{b.name.replace(/^คุณ/, '')} · เข้าพัก {fD(b.checkIn)} – {fDY(b.checkOut)}</div> : <div className="muted-12">ขอบคุณที่มาพักกับเรา</div>}
      </div>
      {b && b.reviewed && <div className="status-ok">คุณเคยส่งแบบประเมินแล้ว ส่งอีกครั้งได้ถ้าต้องการ</div>}
      <div className="pub-stars" role="radiogroup" aria-label="คะแนน">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} ดาว`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      {!b && <label className="field"><span className="field-label">ชื่อ (ไม่บังคับ)</span><input className="input" value={name} onChange={e => setName(e.target.value)} maxLength={100} /></label>}
      <label className="field"><span className="field-label">ความคิดเห็น / ข้อเสนอแนะ</span><textarea className="input" value={comment} onChange={e => setComment(e.target.value)} maxLength={1000} /></label>
      {err && <div className="alert">{err}</div>}
      <button className="btn btn-primary" type="submit" disabled={state === 'sending'} style={{ justifyContent: 'flex-start' }}>{state === 'sending' ? 'กำลังส่ง…' : 'ส่งแบบประเมิน'}</button>
    </form>
  );
}
