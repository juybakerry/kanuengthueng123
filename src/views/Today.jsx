import { KpiGrid, StatusTag } from '../components/ui.jsx';

function Empty({ children }) {
  return <div style={{ padding: '12px 0', color: 'var(--color-neutral-700)' }}>{children}</div>;
}

export default function Today({ v }) {
  const td = v.td;
  return (
    <div className="stack-24 anim-in">
      <KpiGrid items={td.kpis} min={180} />
      <div className="grid-320">
        <section className="stack-8">
          <h4 className="h4">รถรับส่งวันนี้</h4>
          <div className="list">
            {td.pickups.map(p => (
              <button key={p.id} onClick={p.open} className="list-row" style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12 }}>
                <span style={{ fontWeight: 800, fontSize: 18 }}>{p.time}</span>
                <span><strong>{p.name}</strong> · {p.guests} คน<br /><span className="muted-12">รับที่ {p.place} · {p.phone}</span></span>
              </button>
            ))}
            {!td.pickups.length && <Empty>ไม่มีรถรับส่งวันนี้</Empty>}
          </div>
        </section>
        <section className="stack-8">
          <h4 className="h4">ห้องที่ต้องทำความสะอาด</h4>
          <div className="list">
            {td.clean.map(c => (
              <label key={c.id} className="check-row">
                <input type="checkbox" checked={c.done} onChange={c.toggle} className="check" />
                <span style={{ flex: 1, textDecoration: c.done ? 'line-through' : 'none' }}><strong>{c.name}</strong><br /><span className="muted-12">{c.why}</span></span>
              </label>
            ))}
            {!td.clean.length && <Empty>ไม่มีห้องเช็คเอาท์วันนี้</Empty>}
          </div>
        </section>
      </div>
      <div className="grid-320">
        <section className="stack-8">
          <h4 className="h4">เช็คอินวันนี้ ({v.checkInTime})</h4>
          <div className="list">
            {td.arrivals.map(a => (
              <button key={a.id} onClick={a.open} className="list-row row-between" style={{ gap: 12 }}>
                <span><strong>{a.name}</strong> · {a.guests} คน · {a.rooms}<br /><span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{a.allergy}</span></span>
                <span style={{ textAlign: 'right', fontSize: 12 }}><StatusTag x={a} /><br />{a.collect}</span>
              </button>
            ))}
            {!td.arrivals.length && <Empty>ไม่มีเช็คอินวันนี้</Empty>}
          </div>
        </section>
        <section className="stack-8">
          <h4 className="h4">อาหาร (รวมในราคา 1 มื้อ)</h4>
          <div className="stack-6" style={{ borderTop: '2px solid var(--color-divider)', paddingTop: 10 }}>
            <div><span style={{ fontWeight: 800, fontSize: 26 }}>{td.meals}</span> ที่ · ต้นทุนประมาณ {td.mealCost} บาท</div>
            {td.allergies.map((x, i) => <div key={i} className="alert">{x}</div>)}
          </div>
          <h4 className="h4" style={{ marginTop: 12 }}>พรุ่งนี้</h4>
          <div className="list">
            {td.tomorrow.map(a => (
              <button key={a.id} onClick={a.open} className="list-row" style={{ display: 'block' }}>
                <strong>{a.name}</strong> · {a.guests} คน · {a.rooms} <span className="muted-12">{a.pickup}</span>
              </button>
            ))}
            {!td.tomorrow.length && <Empty>ไม่มีเช็คอินพรุ่งนี้</Empty>}
          </div>
        </section>
      </div>
    </div>
  );
}
