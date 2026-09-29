import { Modal, Seg, CloseBtn, FileTags } from '../components/ui.jsx';

export default function ExpenseForm({ v }) {
  const { ef, eh, ev } = v;
  return (
    <Modal onClose={v.closeModal} width={640} style={{ background: 'var(--color-bg)' }}>
      <div className="row-between" style={{ alignItems: 'center', borderBottom: '2px solid var(--color-text)', paddingBottom: 12 }}>
        <div className="dialog-title">{ev.title}</div>
        <CloseBtn onClick={v.closeModal} />
      </div>
      <div className="grid-2">
        <label className="field"><span className="field-label">วันที่เกิดปัญหา / วันที่จ่ายเงิน</span><input className="input" type="date" value={ef.date} onChange={eh.date} /></label>
        <label className="field">
          <span className="field-label">หมวดหมู่ค่าใช้จ่าย</span>
          <select className="input" value={ef.category} onChange={eh.category}>{v.cats.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label className="field span-all"><span className="field-label">หัวข้อปัญหา</span><input className="input" value={ef.title} onChange={eh.title} autoFocus /></label>
        <label className="field span-all"><span className="field-label">รายละเอียด</span><textarea className="input" style={{ minHeight: 64 }} value={ef.detail} onChange={eh.detail} /></label>
        <label className="field"><span className="field-label">จำนวนเงินที่ใช้แก้ไข (บาท)</span><input className="input" type="number" value={ef.amount} onChange={eh.amount} /></label>
        <label className="field"><span className="field-label">เรียกเก็บคืนจากลูกค้า (บาท)</span><input className="input" type="number" value={ef.recovered} onChange={eh.recovered} /></label>
        <label className="field">
          <span className="field-label">ห้องที่เกี่ยวข้อง</span>
          <select className="input" value={ef.roomId} onChange={eh.roomId}>
            <option value="">ไม่ระบุ</option>
            {v.st.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field-label">การจองที่เกี่ยวข้อง</span>
          <select className="input" value={ef.bookingId} onChange={eh.bookingId}>
            <option value="">ไม่ระบุ</option>
            {ev.bookingOpts.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <label className="field"><span className="field-label">ผู้แจ้ง</span><input className="input" value={ef.reporter} onChange={eh.reporter} /></label>
        <label className="field"><span className="field-label">รูปภาพปัญหา / ใบเสร็จ</span><input type="file" accept="image/*" multiple onChange={eh.photos} style={{ font: 'inherit', fontSize: 12 }} /></label>
        <div className="span-all row-wrap-4"><FileTags files={ef.photos} /></div>
        <div className="span-all stack-6">
          <span style={{ fontSize: 12 }}>สถานะ</span>
          <Seg name="est" opts={ev.statusOpts} className="self-start" />
        </div>
      </div>
      <div className="dialog-actions" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn-primary" onClick={v.saveExpense} disabled={ev.invalid}>บันทึก</button>
        <button className="btn btn-secondary" onClick={v.closeModal}>ยกเลิก</button>
        {ev.isEdit && <button className="btn btn-ghost" onClick={v.deleteExpense} style={{ marginLeft: 'auto' }}>ลบรายการ</button>}
      </div>
    </Modal>
  );
}
