import { Modal, Seg, CloseBtn, StatusTag, FileTags } from '../components/ui.jsx';
import PromptPayQR from '../components/PromptPayQR.jsx';

export default function BookingDetail({ v }) {
  const dv = v.dv;
  return (
    <Modal onClose={v.closeModal} width={760} style={{ padding: 0, gap: 0, background: 'var(--color-bg)' }}>
      <div className="modal-head" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div>
          <div className="muted-12">{dv.id} · จองเมื่อ {dv.created} · ผ่าน {dv.channel}</div>
          <div className="dialog-title">{dv.name}</div>
        </div>
        <div className="row-8" style={{ alignItems: 'center' }}><StatusTag x={dv} /><CloseBtn onClick={v.closeModal} /></div>
      </div>
      <div className="facts">
        {dv.facts.map(f => <div key={f.k}><div className="muted-12">{f.k}</div><div style={{ fontWeight: 600 }}>{f.v}</div></div>)}
      </div>
      <div className="stack-14" style={{ padding: '16px 20px' }}>
        {dv.noteText && <div className="alert">{dv.noteText}</div>}
        <div className="money-3">
          <div><div className="muted-12">ยอดรวม</div><div className="money">{dv.total}</div></div>
          <div><div className="muted-12">ชำระแล้ว</div><div className="money">{dv.paid}</div></div>
          <div><div className="muted-12">คงเหลือ</div><div className="money" style={{ color: dv.dueInk }}>{dv.due}</div><div style={{ fontSize: 11 }}>{dv.dueNote}</div></div>
        </div>
        {dv.active && (
          <div className="toolbar">
            <span style={{ fontSize: 13 }}>สถานะการชำระ</span>
            <Seg name="dst" opts={dv.statusOpts} />
          </div>
        )}
        <div className="row-wrap-4" style={{ gap: 6, alignItems: 'center', fontSize: 13 }}>
          <span>สลิป:</span>
          <FileTags files={dv.slips} />
          {!dv.slips.length && <span style={{ color: 'var(--color-neutral-700)' }}>ยังไม่มี</span>}
        </div>
        {dv.reviews.map(r => (
          <div key={r.id} className="review-line">
            <span className="stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span> {r.comment || <span className="muted-12">ไม่มีความคิดเห็น</span>}
          </div>
        ))}
        {v.showQR && (
          <div className="qr-box">
            <PromptPayQR id={dv.promptpay} amount={dv.qrAmount} />
            <div className="stack-6">
              <div className="muted-12">{dv.qrLabel}{dv.promptpayName ? ` · ${dv.promptpayName}` : ''}</div>
              <div style={{ fontWeight: 800, fontSize: 28 }}>{dv.qrAmt} บาท</div>
              <button className="btn btn-secondary" onClick={v.sendQR} style={{ justifyContent: 'flex-start' }}>ส่ง QR ให้ลูกค้าทาง LINE</button>
              <button className="btn btn-ghost" onClick={v.copyPayLink} style={{ justifyContent: 'flex-start' }}>คัดลอกลิงก์หน้าชำระเงิน</button>
            </div>
          </div>
        )}
        {v.confirmCancel && (
          <div className="alert stack-8" style={{ padding: 12 }}>
            <div>ยืนยันยกเลิกการจองนี้? ตามนโยบายไม่คืนมัดจำ ({dv.paid} บาท จะนับเป็นรายรับ)</div>
            <div className="row-8">
              <button className="btn btn-primary" onClick={v.doCancel}>ยืนยันยกเลิก</button>
              <button className="btn btn-secondary" onClick={v.noCancel}>ไม่ยกเลิก</button>
            </div>
          </div>
        )}
      </div>
      <div className="modal-foot">
        {dv.active && (
          <>
            <button className="btn btn-primary" onClick={v.editBooking}>แก้ไข / เลื่อนวัน</button>
            <button className="btn btn-secondary" onClick={v.toggleQR}>QR พร้อมเพย์</button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              แนบสลิป<input type="file" accept="image/*" multiple onChange={v.attachSlip} style={{ display: 'none' }} />
            </label>
          </>
        )}
        <button className="btn btn-secondary" onClick={v.openConfirmDoc}>ใบยืนยันการจอง</button>
        {dv.isPaid && <button className="btn btn-secondary" onClick={v.openReceipt}>ใบเสร็จ</button>}
        {dv.canSurvey && <button className="btn btn-secondary" onClick={v.sendSurvey}>{dv.surveyLabel}</button>}
        {dv.active && <button className="btn btn-ghost" onClick={v.askCancel} style={{ marginLeft: 'auto' }}>ยกเลิกการจอง</button>}
      </div>
    </Modal>
  );
}
