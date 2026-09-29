import { useState } from 'react';

// Shown when the server has ADMIN_PIN set and this browser doesn't have the right PIN yet.
export default function PinGate({ onSubmit, wrong }) {
  const [pin, setPin] = useState('');
  return (
    <div className="splash">
      <form
        className="pin-card"
        onSubmit={e => { e.preventDefault(); if (pin.trim()) onSubmit(pin.trim()); }}
      >
        <div className="brand-name">คะนึงถึง</div>
        <div className="muted-12">ใส่รหัส PIN ของร้านเพื่อเข้าใช้งาน</div>
        {wrong && <div className="alert">รหัส PIN ไม่ถูกต้อง</div>}
        <input className="input" type="password" inputMode="numeric" autoFocus value={pin} onChange={e => setPin(e.target.value)} aria-label="รหัส PIN" />
        <button className="btn btn-primary" type="submit" style={{ justifyContent: 'flex-start' }}>เข้าใช้งาน</button>
      </form>
    </div>
  );
}
