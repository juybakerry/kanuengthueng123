import { KpiGrid, StatusTag } from '../components/ui.jsx';

export default function Expenses({ v }) {
  const ex = v.ex;
  return (
    <div className="stack-24 anim-in">
      <div className="toolbar">
        <div style={{ fontSize: 13, color: 'var(--color-neutral-700)', maxWidth: 560 }}>บันทึกปัญหาและเงินที่ใช้แก้ไข ยอดจะหักออกจากกำไรตามวันที่จ่ายเงิน</div>
        <button className="btn btn-primary" onClick={v.newExpense} style={{ marginLeft: 'auto', minWidth: 150, justifyContent: 'flex-start' }}>+ แจ้งปัญหา</button>
      </div>
      <KpiGrid items={ex.kpis} min={180} size={26} />
      <div style={{ overflowX: 'auto' }}>
        <table className="table" style={{ minWidth: 860 }}>
          <thead>
            <tr><th>วันที่</th><th>ปัญหา</th><th>หมวดหมู่</th><th>เกี่ยวข้อง</th><th>ผู้แจ้ง</th><th className="r">ค่าใช้จ่าย</th><th className="r">เรียกเก็บคืน</th><th>สถานะ</th></tr>
          </thead>
          <tbody>
            {ex.rows.map(r => (
              <tr key={r.id} onClick={r.open} className="clickable">
                <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
                <td><div style={{ fontWeight: 600 }}>{r.title}</div><div className="muted-12">{r.detail}</div></td>
                <td>{r.category}</td>
                <td style={{ fontSize: 13 }}>{r.link}</td>
                <td style={{ fontSize: 13 }}>{r.reporter}</td>
                <td className="r" style={{ fontWeight: 600 }}>{r.amount}</td>
                <td className="r">{r.recovered}</td>
                <td><StatusTag x={r} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
