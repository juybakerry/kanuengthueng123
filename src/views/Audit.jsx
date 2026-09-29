export default function Audit({ v }) {
  return (
    <div className="stack-24 anim-in">
      <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>บันทึกทุกการสร้าง แก้ไข และเปลี่ยนยอดเงิน จากทั้ง 2 เครื่อง</div>
      <div className="table-wrap">
        <table className="table" style={{ minWidth: 720 }}>
          <thead><tr><th>เวลา</th><th>เครื่อง</th><th>การกระทำ</th><th>รายละเอียด</th></tr></thead>
          <tbody>
            {v.auditRows.map((r, i) => (
              <tr key={i}>
                <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{r.t}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{r.device}</td>
                <td style={{ fontWeight: 600 }}>{r.action}</td>
                <td>{r.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
