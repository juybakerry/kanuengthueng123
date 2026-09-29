// Small shared building blocks.
import { withPin } from '../lib/api.js';

// Uploaded images are {name,url}; older entries are just a file name.
export function FileTags({ files }) {
  return files.map((x, i) => {
    const f = typeof x === 'string' ? { name: x } : x;
    return f.url
      ? <a key={i} className="tag tag-neutral file-link" href={withPin(f.url)} target="_blank" rel="noreferrer">{f.name}</a>
      : <span key={i} className="tag tag-neutral">{f.name}</span>;
  });
}

export function Seg({ name, opts, className = '', style, optStyle }) {
  return (
    <div className={'seg ' + className} style={style}>
      {opts.map(o => (
        <label key={o.key ?? o.label} className="seg-opt" style={optStyle}>
          <input type="radio" name={name} checked={o.on} onChange={o.pick} />
          <span>{o.label}</span>
        </label>
      ))}
    </div>
  );
}

export function StatusTag({ x, children }) {
  return <span className="tag" style={{ background: x.soft, color: x.ink }}>{children ?? x.stLabel}</span>;
}

export function KpiGrid({ items, min = 200, size = 30, className = '' }) {
  return (
    <div className={'kpi-grid ' + className} style={{ gridTemplateColumns: `repeat(auto-fit,minmax(${min}px,1fr))` }}>
      {items.map(k => (
        <div key={k.label} className="kpi" style={{ animationDelay: `${k.delay || 0}ms` }}>
          <div className="muted-12">{k.label}</div>
          <div className="kpi-value" style={{ fontSize: size, color: k.color }}>{k.value}</div>
          {k.delta != null && <div style={{ fontSize: 12, color: k.deltaColor }}>{k.delta}</div>}
          {k.sub != null && <div className="muted-12">{k.sub}</div>}
        </div>
      ))}
    </div>
  );
}

export function Modal({ onClose, width, className = 'dialog', z = 50, children, style }) {
  return (
    <div className="dialog-backdrop anim-fade" onClick={onClose} style={{ zIndex: z }}>
      <div
        className={className + ' anim-up'}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
        style={{ width: `min(${width}px,100%)`, maxHeight: 'calc(100vh - 32px)', overflow: 'auto', ...style }}
      >
        {children}
      </div>
    </div>
  );
}

export const Icon = {
  Bell: props => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  ),
  Plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
  ),
  Arrow: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
  Left: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
  ),
  Right: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg>
  ),
  Check: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-400)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
  ),
  X: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
  ),
};

export function CloseBtn({ onClick }) {
  return <button className="btn btn-ghost btn-icon" onClick={onClick} aria-label="ปิด"><Icon.X /></button>;
}

export function PrevNext({ prev, next, children }) {
  return (
    <div className="row-4">
      <button className="btn btn-secondary btn-icon" onClick={prev} aria-label="ก่อนหน้า"><Icon.Left /></button>
      {children}
      <button className="btn btn-secondary btn-icon" onClick={next} aria-label="ถัดไป"><Icon.Right /></button>
    </div>
  );
}
