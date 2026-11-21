/** โครงแอปของพนักงาน: เมนูซ้าย (แท็บเล็ต/คอม) · เมนูล่าง 5 ปุ่ม + ปุ่มลอย "จองใหม่" (มือถือ) */
import { useEffect, useState, type ReactNode } from 'react';
import { CalendarDays, ChartColumn, ClipboardList, Ellipsis, House, Inbox, Moon, Plus, Settings as SettingsIcon, Sun, User, Users, Wrench, ChevronLeft, RefreshCw } from 'lucide-react';
import { useStore, resolveConflict, setToastHook } from '../lib/store';
import { go, open, useNav, initNav, type Tab } from './nav';
import { useTheme } from './theme';
import { Contour, IC, IC24, SyncChip, Toasts, toast } from './ui';
import { Login } from '../screens/Login';
import { Today } from '../screens/Today';
import { CalendarScreen } from '../screens/Calendar';
import { Bookings } from '../screens/Bookings';
import { Dashboard } from '../screens/Dashboard';
import { More } from '../screens/More';
import { Issues, IssueForm } from '../screens/Issues';
import { Customers } from '../screens/Customers';
import { SettingsScreen } from '../screens/Settings';
import { Requests } from '../screens/Requests';
import { BookingDetail } from '../screens/BookingDetail';
import { BookingForm } from '../screens/BookingForm';
import { DocView } from '../screens/DocView';
import { InstallGuide } from '../screens/Install';
import { updateReady, applyUpdate } from '../lib/pwa';

const TITLES: Record<Tab, string> = {
  today: 'วันนี้',
  calendar: 'ปฏิทิน',
  bookings: 'การจอง',
  dashboard: 'สรุปผล',
  more: 'เพิ่มเติม',
  issues: 'แจ้งปัญหา / ค่าใช้จ่าย',
  customers: 'ลูกค้า',
  settings: 'ตั้งค่า',
  requests: 'คำขอจองออนไลน์',
};

const MOBILE_NAV: Array<{ tab: Tab; label: string; icon: ReactNode }> = [
  { tab: 'today', label: 'วันนี้', icon: <House {...IC24} /> },
  { tab: 'calendar', label: 'ปฏิทิน', icon: <CalendarDays {...IC24} /> },
  { tab: 'bookings', label: 'การจอง', icon: <ClipboardList {...IC24} /> },
  { tab: 'dashboard', label: 'สรุปผล', icon: <ChartColumn {...IC24} /> },
  { tab: 'more', label: 'เพิ่มเติม', icon: <Ellipsis {...IC24} /> },
];

const SIDE_NAV: Array<{ tab: Tab; label: string; icon: ReactNode }> = [
  { tab: 'today', label: 'วันนี้', icon: <House {...IC} /> },
  { tab: 'calendar', label: 'ปฏิทิน', icon: <CalendarDays {...IC} /> },
  { tab: 'bookings', label: 'การจอง', icon: <ClipboardList {...IC} /> },
  { tab: 'requests', label: 'คำขอจองออนไลน์', icon: <Inbox {...IC} /> },
  { tab: 'dashboard', label: 'สรุปผล', icon: <ChartColumn {...IC} /> },
  { tab: 'issues', label: 'แจ้งปัญหา', icon: <Wrench {...IC} /> },
  { tab: 'customers', label: 'ลูกค้า', icon: <Users {...IC} /> },
  { tab: 'settings', label: 'ตั้งค่า', icon: <SettingsIcon {...IC} /> },
];

const MORE_TABS: Tab[] = ['more', 'issues', 'customers', 'settings', 'requests'];

export function App() {
  const user = useStore((s) => s.user);
  const booted = useStore((s) => s.booted);
  useEffect(() => {
    initNav();
    setToastHook((m, k) => toast(m, { kind: k }));
  }, []);
  if (!user) return booted ? <Login /> : <Splash />;
  return <Shell />;
}

function Splash() {
  return <div style={{ minHeight: '100dvh', background: '#2F4A3D url(/assets/mood-mist.jpg) center/cover' }} />;
}

function Shell() {
  const nav = useNav();
  const user = useStore((s) => s.user)!;
  const newRequests = useStore((s) => s.ds.requests.filter((r) => r.status === 'new').length);
  const { theme, toggle } = useTheme();
  const [upd, setUpd] = useState(false);
  useEffect(() => updateReady(() => setUpd(true)), []);
  const themeIcon = theme === 'mist' ? <Moon {...IC} /> : <Sun {...IC} />;
  const isMoreChild = nav.tab !== 'more' && MORE_TABS.includes(nav.tab);
  const showFab = ['today', 'calendar', 'bookings'].includes(nav.tab);

  // ทางลัดจากไอคอนแอป "จองใหม่" (/today?new=1)
  useEffect(() => {
    if (nav.params.get('new') === '1') {
      history.replaceState({ stack: [] }, '', `/${nav.tab}`);
      open({ k: 'form', init: {} });
    }
  }, []); // eslint-disable-line

  // ล็อกการเลื่อนหน้าหลักเมื่อมีหน้าซ้อนเปิดอยู่
  useEffect(() => {
    document.body.style.overflow = nav.stack.length ? 'hidden' : '';
  }, [nav.stack.length]);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="เมนูหลัก">
        <svg width="248" height="160" viewBox="0 0 248 160" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ position: 'absolute', left: 0, top: 0, opacity: 0.08, color: 'var(--color-primary)', pointerEvents: 'none' }} aria-hidden>
          <path d="M-10 120 C 40 80, 70 100, 110 60 S 180 40, 260 70" />
          <path d="M-10 136 C 40 96, 80 116, 120 78 S 190 58, 260 88" />
          <path d="M-10 152 C 45 112, 90 132, 130 96 S 200 76, 260 106" />
        </svg>
        <div className="row" style={{ padding: '0 8px', position: 'relative' }}>
          <img src="/assets/logo-mark.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
          <div className="col">
            <span className="heading" style={{ fontSize: 22, lineHeight: 1.2 }}>
              คะนึงถึง
            </span>
            <span className="small muted" style={{ lineHeight: 1.3 }}>
              ห้วยกุ๊บกั๊บ โฮมสเตย์
            </span>
          </div>
        </div>
        <button type="button" className="btn btn-accent" onClick={() => open({ k: 'form', init: {} })} style={{ boxShadow: 'var(--shadow-soft)' }}>
          <Plus {...IC} />
          จองใหม่
        </button>
        <nav>
          {SIDE_NAV.map((n) => (
            <button key={n.tab} type="button" aria-current={nav.tab === n.tab ? 'page' : undefined} onClick={() => go(n.tab)}>
              {n.icon}
              <span>{n.label}</span>
              {n.tab === 'requests' && newRequests > 0 && <span className="badge">{newRequests}</span>}
            </button>
          ))}
        </nav>
        <div className="col gap8" style={{ marginTop: 'auto', padding: '0 6px' }}>
          <div className="row gap8">
            <SyncChip />
            <button type="button" className="icon-btn" aria-label="สลับโหมดหมอกเช้า/กองไฟ" onClick={toggle} style={{ marginLeft: 'auto' }}>
              {themeIcon}
            </button>
          </div>
          <div className="row gap8">
            <span className="icon-tile" style={{ width: 36, height: 36, borderRadius: '50%' }}>
              <User {...IC} />
            </span>
            <div className="col" style={{ lineHeight: 1.3 }}>
              <span className="b" style={{ fontSize: 15 }}>
                {user.displayName}
              </span>
              <span className="small muted">{user.role === 'owner' ? 'เจ้าของกิจการ' : 'พนักงาน'}</span>
            </div>
          </div>
        </div>
      </aside>

      {nav.tab !== 'today' && (
        <header className="page-head">
          <Contour />
          {isMoreChild && (
            <button type="button" className="icon-btn plain mobile-only" aria-label="ย้อนกลับ" onClick={() => go('more')} style={{ marginLeft: -8 }}>
              <ChevronLeft {...IC24} />
            </button>
          )}
          <h1>{TITLES[nav.tab]}</h1>
          <span className="mobile-only">
            <SyncChip />
          </span>
          <button type="button" className="icon-btn mobile-only" aria-label="สลับโหมดหมอกเช้า/กองไฟ" onClick={toggle}>
            {themeIcon}
          </button>
        </header>
      )}

      <main className={`main${nav.tab === 'today' ? ' today' : ''}`}>
        {nav.tab === 'today' && <Today />}
        {nav.tab === 'calendar' && <CalendarScreen />}
        {nav.tab === 'bookings' && <Bookings />}
        {nav.tab === 'dashboard' && <Dashboard />}
        {nav.tab === 'more' && <More />}
        {nav.tab === 'issues' && <Issues />}
        {nav.tab === 'customers' && <Customers />}
        {nav.tab === 'settings' && <SettingsScreen />}
        {nav.tab === 'requests' && <Requests />}
      </main>

      <nav className="bottom-nav" aria-label="เมนูหลัก">
        {MOBILE_NAV.map((n) => {
          const active = n.tab === 'more' ? MORE_TABS.includes(nav.tab) : nav.tab === n.tab;
          return (
            <button key={n.tab} type="button" aria-current={active ? 'page' : undefined} onClick={() => go(n.tab)}>
              <span className="pill">{n.icon}</span>
              <span style={{ lineHeight: 1.4 }}>{n.label}</span>
              {n.tab === 'more' && newRequests > 0 && <span className="badge">{newRequests}</span>}
            </button>
          );
        })}
      </nav>
      {showFab && !nav.stack.length && (
        <button type="button" className="fab" onClick={() => open({ k: 'form', init: {} })}>
          <Plus {...IC24} />
          จองใหม่
        </button>
      )}

      {nav.stack.map((o, i) => {
        const hidden = i < nav.stack.length - 1 && o.k !== 'booking';
        const key = `${i}-${o.k}`;
        if (hidden) return null;
        if (o.k === 'booking') return <BookingDetail key={key} id={o.id} />;
        if (o.k === 'form') return <BookingForm key={key} init={o.init} />;
        if (o.k === 'doc') return <DocView key={key} id={o.id} kind={o.kind} />;
        if (o.k === 'issue') return <IssueForm key={key} id={o.id} bookingId={o.bookingId} />;
        if (o.k === 'install') return <InstallGuide key={key} />;
        return null;
      })}

      <Conflicts />
      <Toasts />
      {upd && (
        <button type="button" className="banner" onClick={applyUpdate}>
          <RefreshCw {...IC} />
          มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต
        </button>
      )}
    </div>
  );
}

function Conflicts() {
  const conflicts = useStore((s) => s.conflicts);
  const c = conflicts[0];
  if (!c) return null;
  const what = c.op.tbl === 'bookings' ? `การจองของ ${(c.op.data.name as string) ?? ''}` : c.op.tbl === 'payments' ? 'รายการรับเงิน' : c.op.tbl === 'settings' ? 'การตั้งค่า' : 'รายการนี้';
  return (
    <div className="dialog" role="alertdialog" aria-modal="true" aria-label="ข้อมูลชนกัน">
      <div>
        <div className="heading" style={{ fontSize: 20 }}>
          ข้อมูลชนกัน
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          อีกเครื่องแก้ไข{what} ไปก่อนที่เครื่องนี้จะซิงก์ เลือกว่าจะเก็บข้อมูลของใคร
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => resolveConflict(c, false)}>
          ใช้ข้อมูลของอีกเครื่อง
        </button>
        <button type="button" className="btn btn-primary" onClick={() => resolveConflict(c, true)}>
          ใช้ข้อมูลของเครื่องนี้
        </button>
      </div>
    </div>
  );
}
