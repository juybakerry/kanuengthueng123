/** 1. Splash / เข้าสู่ระบบ — ภาพทะเลหมอก โลโก้ค่อย ๆ ปรากฏ แล้วเลือกผู้ใช้และใส่รหัสผ่าน */
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, Smartphone, Tablet } from 'lucide-react';
import { api, ApiError, deviceLabel } from '../lib/api';
import { afterLogin } from '../lib/store';
import { IC } from '../app/ui';
import type { UserInfo } from '../domain/types';

export function Login() {
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!username || !password) return;
    setBusy(true);
    setErr('');
    try {
      const device = deviceLabel();
      const r = await api<{ user: UserInfo }>('/api/login', { body: { username, password, device } });
      await afterLogin(r.user, device);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'เข้าสู่ระบบไม่สำเร็จ ลองใหม่อีกครั้ง');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        position: 'fixed',
        inset: 0,
        background: '#2F4A3D url(/assets/mood-mist.jpg) center/cover',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(96px + var(--sat)) 28px calc(40px + var(--sab))',
        overflowY: 'auto',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(22,19,17,.15) 0%,rgba(22,19,17,0) 35%,rgba(22,19,17,.78) 100%)' }} />
      <div className="col" style={{ position: 'relative', alignItems: 'center', gap: 24 }}>
        <img src="/assets/logo-mark.png" alt="คะนึงถึง" width={112} height={112} style={{ borderRadius: 26, boxShadow: '0 12px 32px rgba(0,0,0,.3)', animation: 'mistIn 900ms var(--ease) both' }} />
        <div className="col center" style={{ gap: 8, animation: 'mistIn 900ms var(--ease) 300ms both' }}>
          <h1 style={{ fontSize: 26, color: '#fff' }}>คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์</h1>
          <span className="hand" style={{ fontSize: 20, lineHeight: 1.4 }}>
            โฮมสเตย์เล็ก ๆ สำหรับคนที่อยากหนีความวุ่นวายมาพักผ่อน
          </span>
        </div>
      </div>

      <form onSubmit={submit} className="col gap12" style={{ position: 'relative', width: '100%', maxWidth: 360, marginTop: 32 }}>
        {username === null ? (
          <>
            <span className="center" style={{ fontSize: 15, opacity: 0.9 }}>
              เข้าสู่ระบบในชื่อ
            </span>
            <button type="button" className="btn btn-lg" style={{ height: 56, background: '#F3F1EB', color: '#1F2320' }} onClick={() => setUsername('owner')}>
              <Smartphone {...IC} />
              เจ้าของกิจการ
            </button>
            <button type="button" className="btn btn-lg" style={{ height: 56, border: '1.5px solid rgba(243,241,235,.7)', background: 'rgba(22,19,17,.25)', color: '#fff', backdropFilter: 'blur(6px)' }} onClick={() => setUsername('staff')}>
              <Tablet {...IC} />
              พนักงาน
            </button>
            <button type="button" className="btn btn-text" style={{ color: '#fff', opacity: 0.85, height: 44 }} onClick={() => setUsername('')}>
              ใช้ชื่อผู้ใช้อื่น
            </button>
          </>
        ) : (
          <>
            <label className="field" style={{ color: '#fff' }}>
              ชื่อผู้ใช้
              <input className="input" autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value.trim().toLowerCase())} style={{ background: 'rgba(243,241,235,.95)', color: '#1F2320' }} />
            </label>
            <label className="field" style={{ color: '#fff' }}>
              รหัสผ่าน
              <span style={{ position: 'relative', display: 'block' }}>
                <input
                  className="input"
                  type={show ? 'text' : 'password'}
                  autoComplete="current-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ background: 'rgba(243,241,235,.95)', color: '#1F2320', paddingRight: 52 }}
                />
                <button type="button" className="icon-btn plain" aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShow(!show)} style={{ position: 'absolute', right: 2, top: 2, color: '#1F2320' }}>
                  {show ? <EyeOff {...IC} /> : <Eye {...IC} />}
                </button>
              </span>
            </label>
            {err && (
              <div className="alert" role="alert">
                {err}
              </div>
            )}
            <button type="submit" className="btn btn-accent btn-lg" style={{ height: 56 }} disabled={busy || !username || !password}>
              {busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
            </button>
            <button type="button" className="btn btn-text" style={{ color: '#fff', height: 44 }} onClick={() => { setUsername(null); setErr(''); setPassword(''); }}>
              ย้อนกลับ
            </button>
            <span className="center small" style={{ opacity: 0.85 }}>
              ลืมรหัสผ่าน: ให้เจ้าของกิจการตั้งรหัสใหม่ในหน้าตั้งค่า › ผู้ใช้งาน
            </span>
          </>
        )}
        <span className="hand center" style={{ fontSize: 17, opacity: 0.85, marginTop: 8 }}>
          กองไฟ บทเพลง มิตรภาพ
        </span>
      </form>
    </section>
  );
}
