import { Seg, StatusTag, PrevNext } from '../components/ui.jsx';

function MonthView({ cal }) {
  return (
    <div className="cal-month">
      {cal.dow.map(d => <div key={d} className="cal-dow">{d}</div>)}
      {cal.cells.map(c => (
        <div key={c.d} onClick={c.pick} className="cal-cell" style={{ background: c.bg, color: c.fg, boxShadow: c.ring }}>
          <div className="cal-cell-head">
            <span className="cal-num" style={{ background: c.numBg, color: c.numFg }}>{c.num}</span>
            <span className="cal-info" style={{ color: c.infoInk }}>{c.info}</span>
          </div>
          {c.chips.map(h => (
            <button key={h.id} onClick={h.open} className="cal-chip" style={{ background: h.bg, color: h.fg }}>{h.label}</button>
          ))}
          {c.more && <span className="muted-11">{c.more}</span>}
        </div>
      ))}
    </div>
  );
}

function WeekView({ cal }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <div className="cal-week">
        {cal.week.map(d => (
          <div key={d.d} className="cal-week-col" style={{ boxShadow: d.ring }}>
            <button onClick={d.pick} className="cal-week-head" style={{ background: d.headBg, color: d.headFg }}>
              <div style={{ fontWeight: 700 }}>{d.label}</div><div style={{ fontSize: 11 }}>{d.info}</div>
            </button>
            <div className="stack-6" style={{ padding: 6 }}>
              {d.items.map(h => (
                <button key={h.id} onClick={h.open} className="cal-week-item" style={{ background: h.soft, borderTopColor: h.bg }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{h.name}</span>
                  <span style={{ fontSize: 11 }}>{h.meta}</span>
                  <span style={{ fontSize: 11, color: h.ink }}>{h.stLabel}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineView({ cal }) {
  return (
    <>
      <div className="tl-wrap">
        <div className="tl">
          <div className="tl-row tl-head">
            <div className="tl-name" style={{ fontSize: 12, fontWeight: 600, padding: '6px 8px' }}>ห้อง / วัน</div>
            {cal.tlHead.map(h => (
              <div key={h.d} className="tl-day" style={{ background: h.bg, color: h.fg }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{h.n}</div>{h.dw}
              </div>
            ))}
          </div>
          {cal.tlRows.map(r => (
            <div key={r.id} className="tl-row">
              <div className="tl-name tl-name-cell"><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted-11">{r.sub}</div></div>
              {r.cells.map(c => (
                <button key={c.d} onClick={c.open} title={c.tip} className="tl-cell" style={{ background: c.bg, color: c.fg }}>{c.text}</button>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="muted-12" style={{ marginTop: 8 }}>ตัวเลขในช่อง = จำนวนคนที่พักในห้องคืนนั้น · แตะช่องว่างเพื่อสร้างการจองวันนั้น</div>
    </>
  );
}

export default function Calendar({ v }) {
  const { cal, day } = v;
  return (
    <div className="stack-24 anim-in">
      <div className="toolbar">
        <Seg name="cm" opts={cal.modes} />
        <PrevNext prev={cal.prev} next={cal.next}>
          <button className="btn btn-secondary" onClick={cal.today}>วันนี้</button>
        </PrevNext>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{cal.title}</div>
        <div className="legend" style={{ marginLeft: 'auto', gap: 12, flexWrap: 'wrap', color: 'inherit' }}>
          {v.legend.map(l => <span key={l.label}><i style={{ width: 12, height: 12, background: l.bg }} />{l.label}</span>)}
        </div>
      </div>

      <div className="cal-layout">
        <div style={{ flex: '1 1 600px', minWidth: 0 }}>
          {cal.mode === 'month' && <MonthView cal={cal} />}
          {cal.mode === 'week' && <WeekView cal={cal} />}
          {cal.mode === 'timeline' && <TimelineView cal={cal} />}
        </div>

        <aside className="day-panel">
          <div>
            <div className="muted-12">{day.dow}</div>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{day.title}</div>
          </div>
          <div className="day-stats">
            <div style={{ padding: '10px 0' }}><div className="muted-12">จองแล้ว</div><div className="stat-26">{day.booked} <span>คน</span></div></div>
            <div style={{ padding: '10px 12px' }}><div className="muted-12">เหลือว่าง</div><div className="stat-26" style={{ color: day.leftInk }}>{day.left} <span>/ 24 ที่</span></div></div>
          </div>
          <div>
            {day.rooms.map(r => (
              <div key={r.id} className="day-room">
                <div className="row-between"><strong>{r.name}</strong><span style={{ fontSize: 12, color: r.ink }}>{r.text}</span></div>
                <div className="meter meter-ink"><div style={{ width: `${r.pct}%` }} /></div>
                <div className="muted-12">{r.who}</div>
              </div>
            ))}
          </div>
          <div className="stack-6">
            {day.list.map(h => (
              <button key={h.id} onClick={h.open} className="day-booking">
                <span><span style={{ fontWeight: 600 }}>{h.name}</span><br /><span className="muted-12">{h.meta}</span></span>
                <StatusTag x={h} />
              </button>
            ))}
          </div>
          <div className="stack-6">
            <button className="btn btn-primary btn-block" onClick={day.book}>จองวันที่นี้</button>
            <button className="btn btn-secondary btn-block" onClick={day.toggleClose} style={{ marginTop: 0 }}>{day.closeLabel}</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
