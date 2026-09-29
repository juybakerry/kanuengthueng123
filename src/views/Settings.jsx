import PromptPayQR from '../components/PromptPayQR.jsx';
import { promptpayTarget } from '../lib/promptpay.js';

function Field({ label, children, style }) {
  return <label className="field" style={style}><span className="field-label">{label}</span>{children}</label>;
}

function Check({ checked, onChange, children }) {
  return (
    <label className="row-10" style={{ cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={onChange} className="check" /><span>{children}</span>
    </label>
  );
}

export default function Settings({ v }) {
  const { S, sh, st, cf, info, net } = v;
  const ppOk = !!promptpayTarget(S.promptpay);
  return (
    <div className="stack-24 anim-in">
      <div className="settings-grid">
        <section className="set-section">
          <h4 className="h4">ราคาและการชำระเงิน</h4>
          <Field label="ราคาห้องพัก (บาท / คน / คืน) · รวมที่พัก + อาหาร 1 มื้อ · เด็กคิดเท่าผู้ใหญ่">
            <input className="input" type="number" value={S.price} onChange={sh.price} />
          </Field>
          <div className="grid-3">
            <Field label="เช็คอิน"><input className="input" type="time" value={S.checkInTime} onChange={sh.checkInTime} /></Field>
            <Field label="เช็คเอาท์"><input className="input" type="time" value={S.checkOutTime} onChange={sh.checkOutTime} /></Field>
            <Field label="มัดจำภายใน (วัน)"><input className="input" type="number" value={S.depositDays} onChange={sh.depositDays} /></Field>
          </div>
          <div className="muted-12">มัดจำ 50% · ส่วนที่เหลือชำระวันเข้าพัก · ยกเลิกไม่คืนมัดจำ · เลื่อนวันได้ 1 ครั้ง · รับโอนธนาคาร / พร้อมเพย์ / เงินสด</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>พร้อมเพย์ของร้าน (ใช้สร้าง QR รับเงิน)</div>
          <div className="row-10" style={{ alignItems: 'flex-start', gap: 12 }}>
            <div className="stack-8" style={{ flex: 1 }}>
              <Field label="เบอร์มือถือ หรือเลขประจำตัวผู้เสียภาษี 13 หลัก">
                <input className="input" inputMode="numeric" value={S.promptpay} onChange={sh.promptpay} placeholder="เช่น 0812345678" />
              </Field>
              <Field label="ชื่อบัญชี (แสดงให้ลูกค้าเห็น)">
                <input className="input" value={S.promptpayName} onChange={sh.promptpayName} placeholder="เช่น นางสาว คะนึง ถึงดี" />
              </Field>
              {S.promptpay && !ppOk && <div className="alert">รูปแบบไม่ถูกต้อง ใส่เบอร์มือถือ 10 หลัก หรือเลข 13 หลัก</div>}
            </div>
            {ppOk && <PromptPayQR id={S.promptpay} size={96} />}
          </div>
        </section>

        <section className="set-section">
          <h4 className="h4">ต้นทุนการดำเนินงาน</h4>
          <div className="grid-3">
            <Field label="ค่าอาหาร / หัว / วัน"><input className="input" type="number" value={S.food} onChange={sh.food} /></Field>
            <Field label="ค่าแม่บ้าน / วันที่มีลูกค้า"><input className="input" type="number" value={S.maid} onChange={sh.maid} /></Field>
            <Field label="ค่ารถ / หัว / การจอง"><input className="input" type="number" value={S.transfer} onChange={sh.transfer} /></Field>
          </div>
          <div className="muted-12">ค่ารถรับส่งไม่เก็บจากลูกค้าเพิ่ม (เป็นต้นทุนของร้าน)</div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>ต้นทุนคงที่รายเดือน</div>
          {st.fixed.map(f => (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 36px', gap: 8, alignItems: 'center' }}>
              <input className="input" value={f.name} onChange={f.setName} aria-label="ชื่อรายการ" />
              <input className="input" type="number" value={f.amount} onChange={f.setAmount} aria-label="จำนวนเงิน" />
              <button className="btn btn-ghost btn-icon" onClick={f.remove} aria-label="ลบ">✕</button>
            </div>
          ))}
          <button className="btn btn-secondary self-start" onClick={st.addFixed}>+ เพิ่มรายการ</button>
        </section>

        <section className="set-section">
          <h4 className="h4">ราคาพิเศษ / โปรโมชั่น</h4>
          {st.special.map(p => (
            <div key={p.id} className="special-row">
              <input className="input" value={p.name} onChange={p.setName} style={{ gridColumn: '1 / -1' }} aria-label="ชื่อช่วงราคา" />
              <input className="input" type="date" value={p.from} onChange={p.setFrom} aria-label="ตั้งแต่" />
              <input className="input" type="date" value={p.to} onChange={p.setTo} aria-label="ถึง" />
              <input className="input" type="number" value={p.price} onChange={p.setPrice} aria-label="ราคา" />
              <button className="btn btn-ghost" onClick={p.remove} style={{ justifyContent: 'flex-start' }}>ลบช่วงราคานี้</button>
            </div>
          ))}
          <button className="btn btn-secondary self-start" onClick={st.addSpecial}>+ เพิ่มช่วงราคาเทศกาล</button>
          <div className="grid-2">
            <Field label="ส่วนลดกลุ่มใหญ่ ตั้งแต่ (คน)"><input className="input" type="number" value={S.group.min} onChange={sh.groupMin} /></Field>
            <Field label="ส่วนลด (%)"><input className="input" type="number" value={S.group.pct} onChange={sh.groupPct} /></Field>
          </div>
        </section>

        <section className="set-section">
          <h4 className="h4">ห้องพัก (รวม 24 คน)</h4>
          {st.rooms.map(r => (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', gap: 8, alignItems: 'center' }}>
              <input className="input" value={r.name} onChange={r.setName} aria-label="ชื่อห้อง" />
              <span style={{ fontSize: 13 }}>{r.type}</span><span style={{ fontSize: 13 }}>{r.cap} คน</span>
            </div>
          ))}
        </section>

        <section className="set-section">
          <h4 className="h4">ปิดวัน / ปิดห้อง</h4>
          {st.closures.map(c => (
            <div key={c.id} className="row-between" style={{ alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-divider)' }}>
              <span><strong>{c.range}</strong> · {c.room}<br /><span className="muted-12">{c.reason}</span></span>
              <button className="btn btn-ghost" onClick={c.remove}>ยกเลิกการปิด</button>
            </div>
          ))}
          <div className="grid-2" style={{ gap: 8 }}>
            <input className="input" type="date" value={cf.from} onChange={st.cfFrom} aria-label="ตั้งแต่" />
            <input className="input" type="date" value={cf.to} onChange={st.cfTo} aria-label="ถึง" />
            <select className="input" value={cf.room} onChange={st.cfRoom} aria-label="ห้อง">
              <option value="all">ปิดทั้งโฮมสเตย์</option>
              {st.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <input className="input" placeholder="เหตุผล เช่น ซ่อมแซม" value={cf.reason} onChange={st.cfReason} />
          </div>
          <button className="btn btn-secondary self-start" onClick={st.addClosure}>+ ปิดวัน / ห้อง</button>
        </section>

        <section className="set-section" style={{ gap: 10 }}>
          <h4 className="h4">แจ้งเตือนผ่าน LINE</h4>
          <div className={info && info.line ? 'status-ok' : 'alert'} style={{ fontSize: 13 }}>
            {!info ? 'ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้'
              : !info.line ? 'ยังไม่ได้ตั้งค่า LINE บนเซิร์ฟเวอร์ (ดูวิธีตั้งค่าใน README.md) · ระหว่างนี้ข้อความจะแสดงในหน้าต่างเซิร์ฟเวอร์'
                : info.lineTargets ? `เชื่อมต่อ LINE Official Account แล้ว · ส่งแจ้งเตือนไปที่ ${info.lineTargets} แชท`
                  : 'เชื่อมต่อ LINE แล้ว แต่ยังไม่มีแชทที่ลงทะเบียนรับแจ้งเตือน'}
          </div>
          {info && info.line && (
            <div className="muted-12">
              เพิ่มผู้รับ: เพิ่มเพื่อน LINE OA ของร้าน (หรือเชิญเข้ากลุ่ม) แล้วพิมพ์ <b>ลงทะเบียน {info.pin ? '<รหัส PIN>' : ''}</b> · พิมพ์ <b>ยกเลิกแจ้งเตือน</b> เพื่อหยุด
              {!info.lineWebhook && ' · ต้องตั้ง LINE_CHANNEL_SECRET บนเซิร์ฟเวอร์ก่อน'}
              {info.lineWebhook && <><br />Webhook URL สำหรับ LINE Developers: <code className="code">{info.webhookUrl}</code></>}
            </div>
          )}
          {st.lineOpts.map(o => <Check key={o.key} checked={o.on} onChange={o.toggle}>{o.label}</Check>)}
          <Field label="เวลาส่งสรุปประจำวัน"><input className="input" type="time" value={S.summaryTime} onChange={sh.summaryTime} style={{ maxWidth: 140 }} /></Field>
          <div className="row-8" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={st.lineTest}>ส่งข้อความทดสอบ</button>
            <button className="btn btn-secondary" onClick={st.lineSummary}>ส่งสรุปตอนนี้</button>
          </div>
          <div className="muted-12">การส่งเอกสาร/QR/แบบประเมินให้ลูกค้า ใช้ปุ่มในหน้ารายละเอียดการจอง ระบบจะเปิด LINE ให้เลือกแชทของลูกค้า</div>
        </section>

        <section className="set-section" style={{ gap: 10 }}>
          <h4 className="h4">ใช้งานหลายเครื่อง</h4>
          <div className={net.online ? 'status-ok' : 'alert'} style={{ fontSize: 13 }}>
            {net.online ? 'เชื่อมต่อเซิร์ฟเวอร์แล้ว · ข้อมูลตรงกันทุกเครื่องอัตโนมัติ' : `ออฟไลน์ · แก้ไขได้ตามปกติ ระบบจะส่งข้อมูล${net.pending ? ` ${net.pending} รายการ` : ''} เมื่อเชื่อมต่อได้`}
          </div>
          {info && info.lan.length > 0 && (
            <>
              <div className="muted-12">เปิดลิงก์นี้บนเครื่อง 2 (ต้องต่อ Wi-Fi เดียวกับเครื่องที่รันเซิร์ฟเวอร์)</div>
              {info.lan.map(u => <code key={u} className="code">{u}</code>)}
            </>
          )}
          {info && info.publicUrl && (
            <>
              <div className="muted-12">เปิดลิงก์นี้บนทุกเครื่อง (มือถือ แท็บเล็ต คอมพิวเตอร์) แล้วใส่ PIN</div>
              <code className="code">{info.publicUrl}</code>
            </>
          )}
          <div className="muted-12">{info && info.pin ? 'ป้องกันด้วยรหัส PIN' : 'ยังไม่ได้ตั้งรหัส PIN (ตั้ง ADMIN_PIN ถ้าจะเปิดใช้งานผ่านอินเทอร์เน็ต)'}</div>
        </section>

        <section className="set-section" style={{ gap: 10 }}>
          <h4 className="h4">ลิงก์สำหรับลูกค้า</h4>
          <Field label="ที่อยู่เว็บที่ลูกค้าเข้าถึงได้ (เว้นว่าง = ใช้ที่อยู่ปัจจุบัน)">
            <input className="input" value={S.publicUrl} onChange={sh.publicUrl} placeholder="เช่น https://kanuengthueng.example.com" />
          </Field>
          <Field label="หน้าจองออนไลน์ (ลูกค้าดูวันว่างและส่งคำขอจอง)">
            <div className="row-8"><input className="input" value={st.bookUrl} readOnly /><button className="btn btn-secondary" onClick={st.copyBook}>คัดลอก</button><a className="btn btn-ghost" href="/book" target="_blank" rel="noreferrer">เปิด</a></div>
          </Field>
          <Field label="แบบประเมินความพึงพอใจ (ลิงก์ทั่วไป · ปุ่มในการจองจะส่งลิงก์เฉพาะของลูกค้า)">
            <div className="row-8"><input className="input" value={st.reviewUrl} readOnly /><button className="btn btn-secondary" onClick={st.copyReview}>คัดลอก</button><a className="btn btn-ghost" href="/review" target="_blank" rel="noreferrer">เปิด</a></div>
          </Field>
          {/localhost|127\.0\.0\.1/.test(st.bookUrl) && <div className="alert">ลิงก์นี้ใช้ได้เฉพาะเครื่องนี้ ลูกค้าเปิดไม่ได้ ต้องนำระบบขึ้นอินเทอร์เน็ตก่อน (ดู README.md)</div>}
        </section>

        <section className="set-section" style={{ gap: 10 }}>
          <h4 className="h4">สำรองข้อมูล</h4>
          <Check checked={S.backupAuto} onChange={sh.backupAuto}>สำรองอัตโนมัติทุกวัน 03:00 (เก็บ 30 วัน)</Check>
          <div className="muted-12">สำรองล่าสุด {S.lastBackup}{info ? ` · เก็บข้อมูลที่ ${info.dataFile}` : ''}</div>
          <div className="muted-12">แนะนำให้กด “ดาวน์โหลดไฟล์สำรอง” เก็บไว้ในเครื่องสัปดาห์ละครั้ง เผื่อบริการฟรีมีปัญหา</div>
          <div className="row-8" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={st.backup}>ดาวน์โหลดไฟล์สำรอง</button>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>กู้คืนจากไฟล์<input type="file" accept="application/json,.json" onChange={st.restore} style={{ display: 'none' }} /></label>
          </div>
          <h4 className="h4" style={{ marginTop: 12 }}>ข้อมูลตัวอย่าง</h4>
          <div className="muted-12">ข้อมูลที่เห็นตอนนี้เป็นข้อมูลตัวอย่าง เมื่อพร้อมใช้งานจริงให้กด “เริ่มใช้งานจริง” เพื่อล้างการจองทั้งหมด</div>
          <div className="row-8" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={st.resetEmpty}>เริ่มใช้งานจริง (ล้างข้อมูล)</button>
            <button className="btn btn-ghost" onClick={st.resetDemo}>กลับไปใช้ข้อมูลตัวอย่าง</button>
          </div>
        </section>
      </div>
    </div>
  );
}
