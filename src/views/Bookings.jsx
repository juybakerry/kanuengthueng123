import { Seg, StatusTag } from '../components/ui.jsx';

export default function Bookings({ v }) {
  const bk = v.bk;
  return (
    <div className="stack-24 anim-in">
      {v.requests.length > 0 && (
        <section className="stack-8">
          <h4 className="h4">คำขอจองออนไลน์รอยืนยัน ({v.requests.length})</h4>
          <div className="list">
            {v.requests.map(r => (
              <div key={r.id} className="request-row">
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong>{r.name}</strong> · {r.phone}{r.line ? ` · LINE ${r.line}` : ''}
                  <div className="muted-12">
                    {r.dates} ({r.nights} คืน) · {r.guests} คน · ประมาณ {r.estimateText} บาท{r.transfer ? ` · ขอรถรับส่ง ${r.pickupTime || ''} ${r.pickupPlace || ''}` : ''}
                  </div>
                  {(r.allergy || r.note) && <div style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>{[r.allergy, r.note].filter(Boolean).join(' · ')}</div>}
                  <div className="muted-11">ส่งเมื่อ {r.createdText}</div>
                </div>
                <div className="row-8">
                  <button className="btn btn-primary" onClick={r.accept}>รับจอง</button>
                  <button className="btn btn-ghost" onClick={r.reject}>ปฏิเสธ</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <div className="toolbar">
        <Seg name="bkf" opts={bk.filters} />
        <input className="input" placeholder="ค้นหาชื่อ เบอร์โทร หรือรหัสการจอง" value={bk.q} onChange={bk.setQ} style={{ maxWidth: 320, marginLeft: 'auto' }} />
      </div>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 900 }}>
          <thead>
            <tr><th>รหัส</th><th>ลูกค้า</th><th>เข้าพัก</th><th>คน</th><th>ห้อง</th><th>ช่องทาง</th><th className="r">ยอดรวม</th><th className="r">ค้างชำระ</th><th>สถานะ</th></tr>
          </thead>
          <tbody>
            {bk.rows.map(r => (
              <tr key={r.id} onClick={r.open} className="clickable">
                <td className="muted-12">{r.id}</td>
                <td><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted-12">{r.phone}</div></td>
                <td>{r.dates}<div className="muted-12">{r.nights} คืน</div></td>
                <td>{r.guests}</td>
                <td>{r.rooms}</td>
                <td>{r.channel}</td>
                <td className="r">{r.total}</td>
                <td className="r" style={{ fontWeight: 600, color: r.dueInk }}>{r.due}<div style={{ fontSize: 11, fontWeight: 400 }}>{r.dueNote}</div></td>
                <td><StatusTag x={r} /></td>
              </tr>
            ))}
            {!bk.rows.length && <tr><td colSpan={9} className="muted-12" style={{ padding: 16 }}>ไม่พบรายการ</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="muted-12">{bk.count}</div>
    </div>
  );
}
