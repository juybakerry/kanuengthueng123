import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { promptpayPayload } from '../lib/promptpay.js';

// Renders a scannable Thai QR for the shop's PromptPay ID and an amount.
export default function PromptPayQR({ id, amount, size = 132 }) {
  const payload = promptpayPayload(id, amount);
  const [src, setSrc] = useState('');

  useEffect(() => {
    let alive = true;
    if (!payload) { setSrc(''); return undefined; }
    QRCode.toDataURL(payload, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' })
      .then(u => { if (alive) setSrc(u); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [payload, size]);

  if (!payload) {
    return <div className="qr-placeholder" style={{ width: size, height: size }}>ยังไม่ได้ตั้งเลขพร้อมเพย์<br />(หน้าตั้งค่า)</div>;
  }
  return (
    <div className="qr-img" style={{ width: size, height: size }}>
      {src && <img src={src} width={size} height={size} alt={`QR พร้อมเพย์ ${amount} บาท`} />}
    </div>
  );
}
