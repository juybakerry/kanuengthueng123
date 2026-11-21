/** เมนู "เพิ่มเติม" บนมือถือ */
import type { ReactNode } from 'react';
import { ChevronRight, Download, Inbox, Moon, Settings, Sun, Users, Wrench } from 'lucide-react';
import { useStore } from '../lib/store';
import { go, open } from '../app/nav';
import { useTheme } from '../app/theme';
import { IC } from '../app/ui';
import { isStandalone } from '../lib/pwa';

export function More() {
  const user = useStore((s) => s.user)!;
  const newReq = useStore((s) => s.ds.requests.filter((r) => r.status === 'new').length);
  const openIssues = useStore((s) => s.ds.issues.filter((i) => i.status !== 'done').length);
  const { theme, toggle } = useTheme();
  const items: Array<{ icon: ReactNode; label: string; desc: string; run: () => void; badge?: number }> = [
    { icon: <Inbox {...IC} />, label: 'คำขอจองออนไลน์', desc: newReq ? `มีคำขอใหม่ ${newReq} รายการ` : 'คำขอจากหน้าจองของลูกค้า', run: () => go('requests'), badge: newReq },
    { icon: <Wrench {...IC} />, label: 'แจ้งปัญหา / ค่าใช้จ่าย', desc: openIssues ? `ค้าง ${openIssues} เรื่อง` : 'บันทึกปัญหาและเงินที่ใช้แก้', run: () => go('issues') },
    { icon: <Users {...IC} />, label: 'ลูกค้า', desc: 'รายชื่อ ประวัติการเข้าพัก และแบบประเมิน', run: () => go('customers') },
    { icon: <Settings {...IC} />, label: 'ตั้งค่า', desc: 'ราคา ต้นทุน ห้อง ผู้ใช้ การแจ้งเตือน สำรองข้อมูล', run: () => go('settings') },
  ];
  if (!isStandalone()) items.push({ icon: <Download {...IC} />, label: 'ติดตั้งแอปลงหน้าจอ', desc: 'เปิดเต็มจอ ใช้ออฟไลน์ และรับแจ้งเตือน', run: () => open({ k: 'install' }) });
  return (
    <div className="page" style={{ gap: 12 }}>
      {items.map((m) => (
        <button key={m.label} type="button" className="card" style={{ border: 'none', flexDirection: 'row', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer', minHeight: 72, padding: '14px 16px' }} onClick={m.run}>
          <span className="icon-tile lg">{m.icon}</span>
          <span className="grow" style={{ lineHeight: 1.4 }}>
            <span className="b" style={{ display: 'block', fontSize: 17 }}>
              {m.label}
            </span>
            <span className="small muted" style={{ display: 'block' }}>
              {m.desc}
            </span>
          </span>
          {m.badge ? <span className="badge" style={{ position: 'static' }}>{m.badge}</span> : null}
          <ChevronRight {...IC} color="var(--color-text-muted)" />
        </button>
      ))}
      <button type="button" onClick={toggle} style={{ border: 'none', borderRadius: 16, overflow: 'hidden', position: 'relative', height: 120, background: '#161311 url(/assets/mood-campfire.jpg) center 60%/cover', color: '#fff', textAlign: 'left', padding: 16, display: 'flex', alignItems: 'flex-end', cursor: 'pointer', marginTop: 8 }}>
        <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,rgba(22,19,17,0) 20%,rgba(22,19,17,.85) 100%)' }} />
        <span className="row" style={{ position: 'relative', gap: 10, width: '100%' }}>
          {theme === 'mist' ? <Moon {...IC} /> : <Sun {...IC} />}
          <span className="grow" style={{ lineHeight: 1.35 }}>
            <span className="b" style={{ display: 'block', fontSize: 17 }}>
              สลับเป็นโหมด{theme === 'mist' ? 'กองไฟ' : 'หมอกเช้า'}
            </span>
            <span className="small" style={{ display: 'block', opacity: 0.85 }}>
              {theme === 'mist' ? 'ถนอมสายตาเมื่อใช้งานตอนกลางคืน' : 'สว่าง อ่านง่ายตอนกลางวัน'}
            </span>
          </span>
        </span>
      </button>
      <div className="col muted" style={{ alignItems: 'center', gap: 6, paddingTop: 24 }}>
        <img src="/assets/logo-mark.png" alt="" width={48} height={48} style={{ borderRadius: 12 }} />
        <span className="hand" style={{ fontSize: 18 }}>
          ไว้มาพบกันใหม่เน้อ
        </span>
        <span className="small">เข้าสู่ระบบในชื่อ {user.displayName}</span>
      </div>
    </div>
  );
}
