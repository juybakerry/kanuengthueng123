import { useEffect, useState } from 'react';
import { fD, fDY, baht } from '../lib/core.js';
import PromptPayQR from '../components/PromptPayQR.jsx';

export default function PayPage({ token }) {
  const [b, setB] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    fetch('/api/public/booking/' + encodeURIComponent(token))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error())))
      .then(setB)
      .catch(() => setErr('ไม่พบการจองนี้ กรุณาติดต่อร้าน'));
  }, [token]);

  if (err) return <section className="pub-card">{err}</section>;
  if (!b) return <section className="pub-card">กำลังโหลด…</section>;

  const deposit = b.status === 'unpaid';
  const amount = b.cancelled ? 0 : deposit ? Math.round(b.total / 2) : b.due;
  return (
    <section className="pub-card stack-16">
      <div>
        <div className="muted-12">การจอง {b.id}</div>
        <h2 className="pub-title">คุณ{b.name.replace(/^คุณ/, '')}</h2>
        <div>{fD(b.checkIn)} – {fDY(b.checkOut)} · {b.guests} คน · {b.rooms}</div>
        <div className="muted-12">เช็คอิน {b.checkInTime} · เช็คเอาท์ {b.checkOutTime}</div>
      </div>
      <div className="pub-sum">
        <div className="row-between"><span>ยอดรวม</span><strong>{baht(b.total)} บาท</strong></div>
        <div className="row-between"><span>ชำระแล้ว</span><span>{baht(b.paid)} บาท</span></div>
        <div className="row-between pub-total"><strong>คงเหลือ</strong><strong>{baht(b.due)} บาท</strong></div>
      </div>
      {b.cancelled && <div className="alert">การจองนี้ถูกยกเลิกแล้ว</div>}
      {!b.cancelled && amount <= 0 && <div className="status-ok">ชำระครบแล้ว ขอบคุณค่ะ แล้วพบกันวันเข้าพัก</div>}
      {amount > 0 && (
        <div className="stack-8" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div><strong>{deposit ? `มัดจำ 50% ภายใน ${fD(b.depositDue)}` : `ชำระส่วนที่เหลือ (หรือชำระวันเข้าพัก)`}</strong></div>
          <PromptPayQR id={b.promptpay} amount={amount} size={220} />
          <div style={{ fontWeight: 800, fontSize: 28 }}>{baht(amount)} บาท</div>
          {b.promptpayName && <div className="muted-12">ชื่อบัญชี {b.promptpayName}</div>}
          <div className="muted-12">สแกนด้วยแอปธนาคารใดก็ได้ แล้วส่งสลิปให้ร้านทาง LINE · กดค้างที่รูปเพื่อบันทึก QR</div>
        </div>
      )}
    </section>
  );
}
