import { Modal } from '../components/ui.jsx';
import PromptPayQR from '../components/PromptPayQR.jsx';

export default function DocumentView({ v }) {
  const doc = v.doc;
  return (
    <Modal onClose={v.backToDetail} width={640} className="doc-shell" z={60}>
      <div className="doc-paper">
        <div className="row-between" style={{ gap: 16, borderBottom: '2px solid var(--color-text)', paddingBottom: 14 }}>
          <div><div style={{ fontWeight: 800, fontSize: 24 }}>คะนึงถึงโฮมสเตย์</div><div className="muted-12">ห้วยกุ๊บกั๊บ</div></div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-accent)' }}>{doc.title}</div>
            <div style={{ fontSize: 12 }}>เลขที่ {doc.no}</div>
            <div style={{ fontSize: 12 }}>วันที่ {doc.date}</div>
          </div>
        </div>
        <div className="grid-2" style={{ fontSize: 13 }}>
          <div><div className="muted-12">ลูกค้า</div><strong>{doc.name}</strong><br />{doc.phone}</div>
          <div><div className="muted-12">เข้าพัก</div><strong>{doc.stay}</strong><br />เช็คอิน {v.checkInTime} · เช็คเอาท์ {v.checkOutTime}</div>
        </div>
        <table className="table" style={{ fontSize: 13 }}>
          <thead><tr><th>รายการ</th><th className="r">จำนวนเงิน</th></tr></thead>
          <tbody>
            {doc.lines.map(l => <tr key={l.label}><td>ค่าที่พักรวมอาหาร 1 มื้อ · {l.label}</td><td className="r">{l.amt}</td></tr>)}
            {doc.hasDisc && <tr><td>ส่วนลดกลุ่ม</td><td className="r">−{doc.disc}</td></tr>}
            {doc.transfer && <tr><td>รถรับส่ง ไป–กลับ · {doc.pickup}</td><td className="r">ฟรี</td></tr>}
          </tbody>
        </table>
        <div className="stack-4" style={{ alignSelf: 'flex-end', minWidth: 240, fontSize: 13 }}>
          <div className="row-between"><span>ยอดรวม</span><strong>{doc.total}</strong></div>
          <div className="row-between"><span>ชำระแล้ว</span><span>{doc.paid}</span></div>
          <div className="row-between" style={{ borderTop: '2px solid var(--color-text)', paddingTop: 4, fontSize: 15 }}><strong>คงเหลือ</strong><strong>{doc.due}</strong></div>
        </div>
        {doc.qrAmount > 0 && doc.promptpay && (
          <div className="row-10" style={{ gap: 14, alignItems: 'center' }}>
            <PromptPayQR id={doc.promptpay} amount={doc.qrAmount} size={112} />
            <div style={{ fontSize: 13 }}>
              <div className="muted-12">สแกนชำระ{doc.qrLabel} ผ่านพร้อมเพย์</div>
              <div style={{ fontWeight: 800, fontSize: 20 }}>{doc.qrAmount.toLocaleString('th-TH')} บาท</div>
              {doc.promptpayName && <div className="muted-12">ชื่อบัญชี {doc.promptpayName}</div>}
            </div>
          </div>
        )}
        <div className="muted-12" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 10 }}>
          ชำระผ่านโอนธนาคาร พร้อมเพย์ หรือเงินสด · มัดจำ 50% ภายใน {v.depositDays} วันหลังจอง ส่วนที่เหลือชำระวันเข้าพัก · ยกเลิกไม่คืนมัดจำ เลื่อนวันได้ 1 ครั้ง
        </div>
      </div>
      <div className="row-8 no-print">
        <button className="btn btn-primary" onClick={v.sendDoc}>ส่งให้ลูกค้าทาง LINE</button>
        <button className="btn btn-secondary" onClick={v.exportPdf} style={{ background: 'var(--color-bg)' }}>บันทึก PDF</button>
        <button className="btn btn-secondary" onClick={v.backToDetail} style={{ background: 'var(--color-bg)', marginLeft: 'auto' }}>กลับ</button>
      </div>
    </Modal>
  );
}
