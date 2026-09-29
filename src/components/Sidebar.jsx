import { Seg } from './ui.jsx';

export default function Sidebar({ v }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-name">คะนึงถึง</div>
        <div className="muted-12" style={{ marginTop: 4 }}>โฮมสเตย์ · ห้วยกุ๊บกั๊บ</div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-indicator" style={{ top: 8 + v.navIndex * 42 }} />
        {v.navItems.map(n => (
          <button key={n.key} onClick={n.go} className={'nav-item' + (n.active ? ' is-active' : '')} aria-current={n.active ? 'page' : undefined}>
            <span>{n.label}</span>
            {n.badge > 0 && <span className="nav-badge">{n.badge}</span>}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <div className="eyebrow">กำลังใช้งานบน</div>
        <Seg name="dev" opts={v.deviceOpts} style={{ width: '100%' }} optStyle={{ flex: 1, whiteSpace: 'nowrap', padding: '7px 8px' }} />
        <div className="sync-line"><span className={'live-dot' + (v.online ? '' : ' is-off')} /><span>{v.syncText}</span></div>
      </div>
    </aside>
  );
}
