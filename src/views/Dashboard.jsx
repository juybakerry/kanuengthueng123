import { Seg, KpiGrid, Icon, PrevNext } from '../components/ui.jsx';

export default function Dashboard({ v }) {
  const d = v.dash, h = d.hero;
  return (
    <div className="stack-24 anim-in">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow-accent">{h.greet}</div>
          <div className="hero-number">คืนนี้ {h.booked}<span style={{ color: 'var(--color-neutral-400)' }}>/24</span></div>
          <div style={{ maxWidth: 460, textWrap: 'pretty' }}>{h.line}</div>
          <button className="btn btn-secondary arrow-btn" onClick={h.goToday}><span>ดูงานวันนี้</span><Icon.Arrow /></button>
        </div>
        <div className="hero-rooms">
          {h.rooms.map(r => (
            <div key={r.id} className="stack-6">
              <div className="seat-grid" style={{ gridTemplateColumns: `repeat(${r.cols},22px)` }}>
                {r.cells.map((c, i) => (
                  <div key={i} title={r.name} className="seat" style={{ background: c.bg, borderColor: c.bd, animationDelay: `${c.delay}ms` }} />
                ))}
              </div>
              <div className="seat-label"><strong>{r.name}</strong><span className="muted">{r.text}</span></div>
            </div>
          ))}
        </div>
        <div className="hero-line" />
      </section>

      <div className="toolbar">
        <Seg name="dm" opts={d.modes} />
        {!d.isCustom && (
          <PrevNext prev={d.prev} next={d.next}>
            <div style={{ minWidth: 170, padding: '0 10px', fontWeight: 700, fontSize: 16 }}>{d.label}</div>
          </PrevNext>
        )}
        {d.isCustom && (
          <div className="row-8">
            <input className="input" type="date" value={d.from} onChange={d.setFrom} style={{ width: 'auto' }} />
            <span>ถึง</span>
            <input className="input" type="date" value={d.to} onChange={d.setTo} style={{ width: 'auto' }} />
          </div>
        )}
        <div className="row-8 no-print" style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary" onClick={v.exportExcel}>Export Excel</button>
          <button className="btn btn-secondary" onClick={v.exportPdf}>Export PDF</button>
        </div>
      </div>

      <KpiGrid items={d.kpis} />

      <div className="grid-320">
        <section className="stack-8">
          <h4 className="h4">รายรับ – ต้นทุน</h4>
          <div className="legend">
            <span><i style={{ background: 'var(--color-text)' }} />รายรับ</span>
            <span><i style={{ background: 'var(--color-accent)' }} />ต้นทุน + ค่าใช้จ่าย</span>
            <span>{d.chartNote}</span>
          </div>
          <div className="chart">
            {d.bars.map((b, i) => (
              <div key={i} title={b.tip} className="chart-col">
                <div style={{ background: 'var(--color-text)', height: b.hr, transitionDelay: `${b.delay}ms` }} />
                <div style={{ background: 'var(--color-accent)', height: b.hc, transitionDelay: `${b.delay}ms` }} />
              </div>
            ))}
          </div>
          <div className="chart-labels">
            {d.bars.map((b, i) => <div key={i}>{b.label}</div>)}
          </div>
        </section>
        <section className="stack-8">
          <h4 className="h4">ต้นทุนแยกประเภท</h4>
          <table className="table">
            <tbody>
              {d.costRows.map(r => (
                <tr key={r.label}>
                  <td style={{ width: '46%' }}>{r.label}<div className="muted-11">{r.note}</div></td>
                  <td>
                    <div className="meter"><div style={{ width: `${r.pct}%` }} /></div>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <KpiGrid items={d.stayRows} size={22} className="kpi-grid-soft" />
    </div>
  );
}
