import { useEffect, useRef } from 'react';
import { Icon } from './ui.jsx';

export default function Header({ v }) {
  const ref = useRef(null);
  const { notifOpen, closeNotif } = v;

  // Close the notification dropdown on an outside click.
  useEffect(() => {
    if (!notifOpen) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) closeNotif(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifOpen, closeNotif]);

  return (
    <header className="topbar">
      <div style={{ flex: 1, minWidth: 200 }}>
        <div className="page-title">{v.pageTitle}</div>
        <div className="muted-12">{v.todayText} · <span className="clock">{v.clock}</span></div>
      </div>
      <div style={{ position: 'relative' }} ref={ref}>
        <button className="btn btn-secondary" onClick={v.toggleNotif} style={{ gap: 8 }} aria-expanded={notifOpen}>
          <Icon.Bell className="bell" />
          <span>แจ้งเตือน</span>
          <span className="notif-count">{v.notifs.length}</span>
        </button>
        {notifOpen && (
          <div className="notif-panel anim-drop">
            <div className="notif-head">
              <strong>แจ้งเตือน</strong><span className="muted-11">ส่งเข้า LINE อัตโนมัติ</span>
            </div>
            {v.notifs.map(x => (
              <button key={x.key} onClick={x.open} className="notif-item">
                <span className="notif-kind">{x.kind}</span>
                <span>{x.text}</span>
                <span className="muted-12">{x.meta}</span>
              </button>
            ))}
            {!v.notifs.length && <div style={{ padding: '12px 14px' }} className="muted-12">ไม่มีการแจ้งเตือน</div>}
          </div>
        )}
      </div>
      <button className="btn btn-primary lift" onClick={v.newBooking} style={{ justifyContent: 'flex-start', minWidth: 150 }}>
        <Icon.Plus />
        <span>การจองใหม่</span>
      </button>
    </header>
  );
}
