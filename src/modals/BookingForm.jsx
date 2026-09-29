import { Modal, Seg, CloseBtn, FileTags } from '../components/ui.jsx';

export default function BookingForm({ v }) {
  const { bf, bh, fv } = v;
  return (
    <Modal onClose={v.closeModal} width={1000} style={{ padding: 0, gap: 0, background: 'var(--color-bg)' }}>
      <div className="modal-head">
        <div className="dialog-title">{fv.title}</div>
        <CloseBtn onClick={v.closeModal} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <div className="stack-16" style={{ flex: '1 1 560px', minWidth: 0, padding: 20 }}>
          <div className="grid-fit-200">
            <div className="field" style={{ position: 'relative', gridColumn: '1 / -1' }}>
              <label htmlFor="bf-name">ชื่อลูกค้า / ชื่อกลุ่ม</label>
              <input id="bf-name" className="input" value={bf.name} onChange={bh.name} placeholder="พิมพ์เพื่อค้นหาลูกค้าเก่า" autoComplete="off" autoFocus />
              {fv.sugs.length > 0 && (
                <div className="suggest">
                  {fv.sugs.map(x => (
                    <button key={x.key} onClick={x.pick}><strong>{x.name}</strong> <span className="muted-12">{x.meta}</span></button>
                  ))}
                </div>
              )}
            </div>
            <label className="field"><span className="field-label">เบอร์โทรศัพท์</span><input className="input" type="tel" value={bf.phone} onChange={bh.phone} /></label>
            <label className="field"><span className="field-label">LINE ID</span><input className="input" value={bf.line} onChange={bh.line} /></label>
            <label className="field"><span className="field-label">วันเข้าพัก</span><input className="input" type="date" value={bf.checkIn} onChange={bh.checkIn} /></label>
            <label className="field"><span className="field-label">วันออก</span><input className="input" type="date" value={bf.checkOut} onChange={bh.checkOut} /></label>
            <label className="field"><span className="field-label">ผู้ใหญ่</span><input className="input" type="number" min="0" value={bf.adults} onChange={bh.adults} /></label>
            <label className="field"><span className="field-label">เด็ก (คิดราคาเท่าผู้ใหญ่)</span><input className="input" type="number" min="0" value={bf.children} onChange={bh.children} /></label>
          </div>

          <div className="stack-6">
            <div className="row-between" style={{ alignItems: 'center' }}>
              <strong>ห้องที่พัก</strong>
              <button className="btn btn-ghost" onClick={v.autoAlloc}>จัดห้องอัตโนมัติ</button>
            </div>
            <div style={{ borderTop: '2px solid var(--color-divider)' }}>
              {fv.roomRows.map(r => (
                <div key={r.id} className="room-row">
                  <div style={{ flex: 1 }}><strong>{r.name}</strong> <span className="muted-12">{r.type} · {r.cap} คน</span></div>
                  <span style={{ fontSize: 12, color: r.availInk, minWidth: 70 }}>{r.availText}</span>
                  <div className="stepper">
                    <button className="btn btn-icon" onClick={r.dec} aria-label={`ลดจำนวนคน ${r.name}`}>−</button>
                    <span>{r.count}</span>
                    <button className="btn btn-icon" onClick={r.inc} aria-label={`เพิ่มจำนวนคน ${r.name}`}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-fit-200">
            <label className="row-10" style={{ gridColumn: '1 / -1', cursor: 'pointer' }}>
              <input type="checkbox" checked={bf.transfer} onChange={bh.transfer} className="check" />
              <strong>ใช้รถรับส่ง</strong> <span className="muted-12">(ไป–กลับ ไม่เก็บเงินเพิ่ม)</span>
            </label>
            {bf.transfer && (
              <>
                <label className="field"><span className="field-label">จุดรับ</span><input className="input" value={bf.pickupPlace} onChange={bh.pickupPlace} /></label>
                <label className="field"><span className="field-label">เวลารับ</span><input className="input" type="time" value={bf.pickupTime} onChange={bh.pickupTime} /></label>
              </>
            )}
          </div>

          <div className="stack-6">
            <strong>ช่องทางที่จองมา</strong>
            <Seg name="ch" opts={fv.channelOpts} className="self-start" />
          </div>
          <div className="grid-fit-200">
            <label className="field"><span className="field-label">อาหารที่แพ้ / ความต้องการพิเศษ</span><textarea className="input" style={{ minHeight: 64 }} value={bf.allergy} onChange={bh.allergy} /></label>
            <label className="field"><span className="field-label">หมายเหตุ</span><textarea className="input" style={{ minHeight: 64 }} value={bf.note} onChange={bh.note} /></label>
          </div>
        </div>

        <div className="summary-pane">
          <div className="eyebrow-accent" style={{ fontSize: 11, letterSpacing: '.08em' }}>สรุปยอด</div>
          <div style={{ fontSize: 13 }}>{fv.summary}</div>
          <div className="stack-4" style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 8 }}>
            {fv.lines.map(l => <div key={l.label} className="row-between" style={{ fontSize: 13 }}><span>{l.label}</span><span>{l.amt}</span></div>)}
            {fv.hasDisc && <div className="row-between" style={{ fontSize: 13, color: 'var(--color-accent-700)' }}><span>{fv.discLabel}</span><span>−{fv.disc}</span></div>}
          </div>
          <div className="row-between" style={{ alignItems: 'baseline', borderTop: '2px solid var(--color-text)', paddingTop: 8 }}>
            <strong>ยอดรวม</strong><span style={{ fontWeight: 800, fontSize: 28 }}>{fv.total}</span>
          </div>
          <div className="stack-4" style={{ fontSize: 13 }}>
            <div className="row-between"><span>มัดจำ 50% (ภายใน {fv.depositDue})</span><strong>{fv.deposit}</strong></div>
            <div className="row-between"><span>คงเหลือ (ชำระวันเข้าพัก)</span><strong>{fv.balance}</strong></div>
          </div>
          <div className="stack-6">
            <strong style={{ fontSize: 13 }}>สถานะการชำระเงิน</strong>
            <Seg name="bst" opts={fv.statusOpts} optStyle={{ flex: 1 }} />
          </div>
          <label className="field">
            <span className="field-label">แนบสลิปโอนเงิน</span>
            <input type="file" accept="image/*" multiple onChange={bh.slips} style={{ font: 'inherit', fontSize: 12 }} />
          </label>
          <div className="row-wrap-4"><FileTags files={bf.slips} /></div>
          {fv.hasErrors && (
            <div className="error-box">
              {fv.errors.map(e => <div key={e}>{e}</div>)}
            </div>
          )}
          <div className="row-8" style={{ marginTop: 'auto' }}>
            <button className="btn btn-primary" onClick={v.saveBooking} disabled={fv.hasErrors} style={{ flex: 1, justifyContent: 'flex-start' }}>บันทึกการจอง</button>
            <button className="btn btn-secondary" onClick={v.closeModal}>ยกเลิก</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
