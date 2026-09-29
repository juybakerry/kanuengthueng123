import { Modal, CloseBtn, StatusTag } from '../components/ui.jsx';

export default function CustomerDetail({ v }) {
  const cv = v.cv;
  return (
    <Modal onClose={v.closeModal} width={640} style={{ background: 'var(--color-bg)' }}>
      <div className="row-between" style={{ alignItems: 'flex-start', borderBottom: '2px solid var(--color-text)', paddingBottom: 12 }}>
        <div>
          <div className="dialog-title">{cv.name}</div>
          <div style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{cv.phone} · LINE {cv.line}</div>
        </div>
        <CloseBtn onClick={v.closeModal} />
      </div>
      {cv.allergy && <div className="alert">{cv.allergy}</div>}
      {cv.reviews.map(r => (
        <div key={r.id} className="review-line"><span className="stars">{r.stars}</span> <span className="muted-12">{r.dateText}</span>{r.comment && <div>{r.comment}</div>}</div>
      ))}
      <table className="table">
        <thead><tr><th>เข้าพัก</th><th>คน</th><th className="r">ยอด</th><th>สถานะ</th></tr></thead>
        <tbody>
          {cv.stays.map(r => (
            <tr key={r.id} onClick={r.open} className="clickable">
              <td>{r.dates}</td><td>{r.guests}</td><td className="r">{r.total}</td><td><StatusTag x={r} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn-primary" onClick={cv.rebook}>จองอีกครั้ง</button>
      </div>
    </Modal>
  );
}
