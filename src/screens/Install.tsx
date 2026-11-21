/** หน้าแนะนำการติดตั้ง: ตรวจระบบอัตโนมัติ — iPhone/iPad แสดงขั้นตอน "แชร์ → เพิ่มไปยังหน้าจอโฮม" · Android ใช้ปุ่มติดตั้ง */
import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, Ellipsis } from 'lucide-react';
import { close } from '../app/nav';
import { CloseBtn, IC, toast, useEscape } from '../app/ui';
import { canPromptInstall, isStandalone, onInstallable, platform, promptInstall } from '../lib/pwa';

export function InstallGuide() {
  useEscape(close);
  const p = platform();
  const [can, setCan] = useState(canPromptInstall());
  useEffect(() => onInstallable(() => setCan(true)), []);
  return (
    <section className="overlay" aria-label="ติดตั้งแอป">
      <div className="overlay-head" style={{ padding: '8px 16px' }}>
        <h1>ติดตั้งแอปลงหน้าจอ</h1>
        <CloseBtn onClick={close} />
      </div>
      <div className="overlay-body">
        <div className="inner">
          {isStandalone() ? (
            <div className="alert info">ติดตั้งเรียบร้อยแล้ว — กำลังใช้งานแบบแอป</div>
          ) : (
            <>
              <div className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <img src="/icons/icon-192.png" alt="" width={88} height={88} style={{ borderRadius: 20 }} />
                <div className="heading" style={{ fontSize: 20 }}>
                  คะนึงถึง
                </div>
                <div className="small muted">เปิดเต็มจอเหมือนแอป · ใช้ได้แม้เน็ตหลุด · รับแจ้งเตือนการจองใหม่ · ไม่ต้องผ่าน App Store / Play Store</div>
              </div>
              {p === 'ios' && (
                <div className="card">
                  <div className="card-title">iPhone / iPad (ต้องเปิดด้วย Safari)</div>
                  <Step n={1} icon={<Share {...IC} />} text="แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรชี้ขึ้น) ที่แถบล่างหรือด้านบนของ Safari — ถ้าไม่เห็น แตะ ••• ก่อน" />
                  <Step n={2} icon={<SquarePlus {...IC} />} text='เลื่อนหาแล้วแตะ "เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)' />
                  <Step n={3} icon={<Download {...IC} />} text='แตะ "เพิ่ม" แล้วเปิดแอป "คะนึงถึง" จากหน้าจอโฮม และเข้าสู่ระบบอีกครั้ง' />
                  <div className="small muted">ต้องเป็น iOS / iPadOS 16.4 ขึ้นไป จึงจะรับแจ้งเตือนได้ (เปิดได้ที่ ตั้งค่า › การแจ้งเตือน หลังติดตั้ง)</div>
                </div>
              )}
              {p === 'android' && (
                <div className="card">
                  <div className="card-title">Android (Chrome)</div>
                  {can ? (
                    <button type="button" className="btn btn-accent btn-lg" onClick={async () => { if (await promptInstall()) { toast('ติดตั้งแล้ว เปิดจากไอคอน "คะนึงถึง" ได้เลย'); close(); } }}>
                      <Download {...IC} />
                      ติดตั้งแอป
                    </button>
                  ) : (
                    <>
                      <Step n={1} icon={<Ellipsis {...IC} />} text="แตะเมนู ⋮ มุมขวาบนของ Chrome" />
                      <Step n={2} icon={<Download {...IC} />} text='เลือก "ติดตั้งแอป" หรือ "เพิ่มลงในหน้าจอหลัก" แล้วแตะ "ติดตั้ง"' />
                    </>
                  )}
                </div>
              )}
              {p === 'desktop' && (
                <div className="card">
                  <div className="card-title">คอมพิวเตอร์ (Chrome / Edge)</div>
                  {can ? (
                    <button type="button" className="btn btn-accent btn-lg" onClick={() => void promptInstall()}>
                      <Download {...IC} />
                      ติดตั้งแอป
                    </button>
                  ) : (
                    <Step n={1} icon={<Download {...IC} />} text="คลิกไอคอนติดตั้ง (จอที่มีลูกศร) ทางขวาของช่องที่อยู่เว็บ" />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
      <span className="icon-tile" style={{ position: 'relative' }}>
        {icon}
        <span className="badge" style={{ top: -6, right: -6, background: 'var(--color-primary)' }}>
          {n}
        </span>
      </span>
      <span style={{ paddingTop: 8 }}>{text}</span>
    </div>
  );
}
