export default function Customers({ v }) {
  const cu = v.cu;
  return (
    <div className="stack-24 anim-in">
      <section className="stack-8">
        <div className="row-between" style={{ alignItems: 'baseline' }}>
          <h4 className="h4">ความพึงพอใจของลูกค้า</h4>
          <span className="muted-12">{cu.reviews.count ? `เฉลี่ย ${cu.reviews.avg} / 5 จาก ${cu.reviews.count} รีวิว` : 'ยังไม่มีรีวิว · ส่งแบบประเมินจากหน้ารายละเอียดการจองหลังเช็คเอาท์'}</span>
        </div>
        {cu.reviews.rows.length > 0 && (
          <div className="list">
            {cu.reviews.rows.slice(0, 6).map(r => (
              <button key={r.id} className="list-row" onClick={r.open || undefined} disabled={!r.open} style={{ display: 'block' }}>
                <span className="stars">{r.stars}</span> <strong>{r.name}</strong> <span className="muted-12">· {r.dateText}</span>
                {r.comment && <div style={{ fontSize: 13 }}>{r.comment}</div>}
              </button>
            ))}
          </div>
        )}
      </section>
      <input className="input" placeholder="ค้นหาชื่อ เบอร์โทร หรือ LINE ID" value={cu.q} onChange={cu.setQ} style={{ maxWidth: 360 }} />
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 760 }}>
          <thead>
            <tr><th>ลูกค้า</th><th>LINE</th><th>เข้าพัก</th><th>ล่าสุด</th><th className="r">ยอดใช้จ่ายรวม</th><th>ความต้องการพิเศษ</th></tr>
          </thead>
          <tbody>
            {cu.rows.map(r => (
              <tr key={r.key} onClick={r.open} className="clickable">
                <td><div style={{ fontWeight: 600 }}>{r.name}</div><div className="muted-12">{r.phone}</div></td>
                <td>{r.line}</td>
                <td>{r.stays} ครั้ง · {r.nights} คืน</td>
                <td>{r.last}</td>
                <td className="r">{r.spent}</td>
                <td style={{ fontSize: 13, color: 'var(--color-accent-700)' }}>{r.allergy}</td>
              </tr>
            ))}
            {!cu.rows.length && <tr><td colSpan={6} className="muted-12" style={{ padding: 16 }}>ไม่พบลูกค้า</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
