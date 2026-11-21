/** 9. ตั้งค่า — ราคา ต้นทุน ห้อง ปิดห้อง/วัน ราคาพิเศษ ต้นทุนคงที่ หมวดค่าใช้จ่าย ผู้ใช้ แจ้งเตือน สำรองข้อมูล ธีม (FR-15) */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bell, Database, Download, KeyRound, Lock, LogOut, Moon, Pencil, Plus, RefreshCw, Smartphone, Sun, SunMoon, Trash, Upload, UserPlus } from 'lucide-react';
import { useStore, save, remove, newId, logout, syncNow, getState } from '../lib/store';
import { api, ApiError } from '../lib/api';
import { open } from '../app/nav';
import { useTheme } from '../app/theme';
import { Chips, Field, IC, IC16, MoneyInput, Seg, Sheet, Toggle, confirmDialog, toast } from '../app/ui';
import { disablePush, enablePush, isStandalone, pushState } from '../lib/pwa';
import { exportAllExcel } from '../lib/exports';
import { qrDataUrl } from '../lib/share';
import { addDays, fmtDate, fmtDateTime, fmtRange, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { promptpayPayload, promptpayTarget } from '../domain/promptpay';
import { ROOM_KIND_LABEL } from '../domain/defaults';
import type { BookingMode, Closure, PriceRule, Room, Settings, UserInfo } from '../domain/types';

function Card({ title, children, desc }: { title: ReactNode; children: ReactNode; desc?: ReactNode }) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      {desc && <div className="small muted" style={{ marginTop: -8 }}>{desc}</div>}
      {children}
    </div>
  );
}

function MoneyRow({ label, unit, value, onChange }: { label: string; unit?: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="row" style={{ gap: 12 }}>
      <span className="grow" style={{ lineHeight: 1.4 }}>
        <span className="b" style={{ display: 'block', fontSize: 15 }}>
          {label}
        </span>
        {unit && <span className="small muted">{unit}</span>}
      </span>
      <MoneyInput value={value} onChange={(v) => onChange(v ?? 0)} ariaLabel={label} width={120} />
    </label>
  );
}

function NumRow({ label, unit, value, onChange, min = 0, max = 100 }: { label: string; unit?: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="row" style={{ gap: 12 }}>
      <span className="grow" style={{ lineHeight: 1.4 }}>
        <span className="b" style={{ display: 'block', fontSize: 15 }}>
          {label}
        </span>
        {unit && <span className="small muted">{unit}</span>}
      </span>
      <input className="input money" inputMode="numeric" value={String(value)} style={{ width: 120 }} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))); }} aria-label={label} />
    </label>
  );
}

export function SettingsScreen() {
  const ds = useStore((s) => s.ds);
  const user = useStore((s) => s.user)!;
  const [draft, setDraft] = useState<Settings>(ds.settings);
  const saved = JSON.stringify(ds.settings);
  const base = useRef(saved);
  useEffect(() => {
    // อีกเครื่องเปลี่ยนการตั้งค่า → อัปเดตฟอร์มถ้ายังไม่ได้แก้ในเครื่องนี้
    if (JSON.stringify(draft) === base.current) setDraft(ds.settings);
    base.current = saved;
  }, [saved]); // eslint-disable-line
  const dirty = JSON.stringify(draft) !== saved;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setH = (k: keyof Settings['homestay'], v: string) => setDraft((d) => ({ ...d, homestay: { ...d.homestay, [k]: v } }));
  const ppOk = !draft.promptpayId || !!promptpayTarget(draft.promptpayId);

  function commit() {
    if (!ppOk) return toast('เลขพร้อมเพย์ต้องเป็นเบอร์มือถือ 10 หลัก หรือเลขบัตร/ภาษี 13 หลัก', { kind: 'error' });
    save('settings', { ...draft, id: 'main' }, { summary: 'แก้ไขการตั้งค่า' });
    toast('บันทึกการตั้งค่าแล้ว · ราคาใหม่มีผลกับการจองใหม่เท่านั้น');
  }

  return (
    <div className="page" style={{ paddingBottom: dirty ? 80 : 0 }}>
      <div className="grid-2">
        <div className="col gap16">
          <ThemeCard />
          <Card title="ราคาและต้นทุน" desc="ค่าที่เปลี่ยนมีผลกับการจองใหม่เท่านั้น (การจองเดิมเก็บราคา ณ วันจอง)">
            <MoneyRow label="ราคาห้องพัก" unit="บาท / คน / คืน (รวมอาหาร 1 มื้อ)" value={draft.pricePerPerson} onChange={(v) => set('pricePerPerson', v)} />
            <NumRow label="มัดจำ" unit="% ของยอดรวม" value={draft.depositPct} onChange={(v) => set('depositPct', v)} />
            <NumRow label="ชำระมัดจำภายใน" unit="วัน หลังวันจอง" value={draft.depositDueDays} max={60} onChange={(v) => set('depositDueDays', v)} />
            <MoneyRow label="ค่าอาหาร" unit="บาท / คน / คืน" value={draft.mealCost} onChange={(v) => set('mealCost', v)} />
            <MoneyRow label="ค่าแม่บ้าน" unit="บาท / วันที่มีแขก (ไม่ขึ้นกับจำนวนแขก)" value={draft.housekeepingCost} onChange={(v) => set('housekeepingCost', v)} />
            <MoneyRow label="ค่ารถรับส่ง" unit="บาท / คน / การจอง (ไป–กลับ) · ต้นทุนร้าน ไม่เก็บเพิ่ม" value={draft.transportCost} onChange={(v) => set('transportCost', v)} />
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="เวลาเช็คอิน">
                <input className="input" type="time" value={draft.checkInTime} onChange={(e) => set('checkInTime', e.target.value || '14:00')} />
              </Field>
              <Field label="เวลาเช็คเอาท์">
                <input className="input" type="time" value={draft.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value || '11:00')} />
              </Field>
            </div>
            <div className="field">
              รูปแบบการจอง
              <Chips value={draft.bookingMode} onChange={(v: BookingMode) => set('bookingMode', v)} options={[{ v: 'both', label: 'ได้ทั้งสองแบบ' }, { v: 'person', label: 'รายคน / รายเตียง' }, { v: 'room', label: 'ทั้งห้อง' }]} />
            </div>
            <NumRow label="เลื่อนวันได้" unit="ครั้ง ต่อการจอง" value={draft.rescheduleLimit} max={10} onChange={(v) => set('rescheduleLimit', v)} />
            <Toggle on={draft.cancelForfeitsDeposit} onChange={(v) => set('cancelForfeitsDeposit', v)} title="ยกเลิกแล้วไม่คืนมัดจำ" desc="มัดจำนับเป็นรายรับของวันที่ยกเลิก" />
            <Field label="เวลารถรับส่งที่ใช้บ่อย (คั่นด้วยเว้นวรรค)">
              <input className="input" value={draft.transportTimes.join(' ')} onChange={(e) => set('transportTimes', e.target.value.split(/[\s,]+/).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0')))} placeholder="10:00 12:00 13:00 15:00" />
            </Field>
          </Card>
          <Card title="การรับเงิน" desc="ใช้สร้าง QR พร้อมเพย์พร้อมยอดเงิน (ไม่ต้องใช้ API ธนาคาร) และแสดงในใบยืนยัน">
            <Field label="เลขพร้อมเพย์ (เบอร์มือถือ หรือเลขบัตร/ภาษี 13 หลัก)">
              <input className="input num" inputMode="numeric" value={draft.promptpayId} onChange={(e) => set('promptpayId', e.target.value.replace(/[^\d-]/g, ''))} placeholder="08x-xxx-xxxx" />
            </Field>
            {!ppOk && <div className="small danger">รูปแบบเลขพร้อมเพย์ไม่ถูกต้อง</div>}
            <Field label="ชื่อบัญชีพร้อมเพย์ (แสดงให้ลูกค้าตรวจสอบ)">
              <input className="input" value={draft.promptpayName} onChange={(e) => set('promptpayName', e.target.value)} placeholder="เช่น นายสมชาย ใจดี" />
            </Field>
            <Field label="บัญชีธนาคารสำหรับโอน (ไม่บังคับ)">
              <input className="input" value={draft.bankAccount} onChange={(e) => set('bankAccount', e.target.value)} placeholder="เช่น กสิกรไทย 123-4-56789-0 ชื่อบัญชี …" />
            </Field>
            {ppOk && draft.promptpayId && <QrTest id={draft.promptpayId} />}
          </Card>
          <Card title="ข้อมูลกิจการ" desc="แสดงในใบยืนยัน ใบเสร็จ และหน้าจองออนไลน์">
            <Field label="ชื่อกิจการ">
              <input className="input" value={draft.homestay.name} onChange={(e) => setH('name', e.target.value)} />
            </Field>
            <Field label="ที่อยู่">
              <input className="input" value={draft.homestay.address} onChange={(e) => setH('address', e.target.value)} />
            </Field>
            <div className="grid-2" style={{ gap: 12 }}>
              <Field label="เบอร์โทร">
                <input className="input" inputMode="tel" value={draft.homestay.phone} onChange={(e) => setH('phone', e.target.value)} />
              </Field>
              <Field label="LINE ID ของร้าน">
                <input className="input" value={draft.homestay.lineId} onChange={(e) => setH('lineId', e.target.value)} placeholder="@xxxx" />
              </Field>
              <Field label="Facebook">
                <input className="input" value={draft.homestay.facebook} onChange={(e) => setH('facebook', e.target.value)} />
              </Field>
              <Field label="Instagram">
                <input className="input" value={draft.homestay.instagram} onChange={(e) => setH('instagram', e.target.value)} />
              </Field>
            </div>
            <Field label="คำโปรย">
              <input className="input" value={draft.homestay.tagline} onChange={(e) => setH('tagline', e.target.value)} />
            </Field>
          </Card>
        </div>

        <div className="col gap16">
          <RoomsCard />
          <ClosuresCard />
          <PriceRulesCard />
          <FixedCostsCard />
          <CategoriesCard />
          <UsersCard me={user} />
          <NotifyCard draft={draft} set={set} />
          <Card title="หน้าจองออนไลน์ (ลูกค้า)">
            <Toggle on={draft.publicBooking} onChange={(v) => set('publicBooking', v)} title="เปิดรับคำขอจองออนไลน์" desc={`${location.origin}/book · ลูกค้าเห็นเฉพาะวันว่าง`} />
            <a className="btn btn-ghost btn-sm" href="/book" target="_blank" rel="noopener">
              เปิดดูหน้าจองของลูกค้า
            </a>
          </Card>
          <DataCard me={user} />
        </div>
      </div>

      {dirty && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 35, padding: '12px 16px calc(84px + var(--sab))', background: 'var(--nav-bg)', borderTop: '1px solid var(--color-surface-2)' }} className="settings-bar">
          <div className="row gap8" style={{ maxWidth: 720, margin: '0 auto' }}>
            <span className="grow small b">มีการแก้ไขที่ยังไม่บันทึก</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDraft(ds.settings)}>
              ยกเลิก
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={commit}>
              บันทึกการตั้งค่า
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ThemeCard() {
  const { pref, set } = useTheme();
  return (
    <Card title="ธีม">
      <Seg
        value={pref}
        onChange={set}
        label="ธีม"
        options={[
          { v: 'mist', label: <><Sun {...IC16} />หมอกเช้า</> },
          { v: 'campfire', label: <><Moon {...IC16} />กองไฟ</> },
          { v: 'auto', label: <><SunMoon {...IC16} />อัตโนมัติ</> },
        ]}
      />
      <div className="small muted">อัตโนมัติ: ตามโหมดมืดของเครื่อง หรือหมอกเช้า 06:00–18:00 · กองไฟหลัง 18:00</div>
    </Card>
  );
}

function QrTest({ id }: { id: string }) {
  const [img, setImg] = useState('');
  useEffect(() => {
    const p = promptpayPayload(id, 100);
    if (p) void qrDataUrl(p, 240).then(setImg);
  }, [id]);
  return img ? (
    <div className="row" style={{ gap: 12 }}>
      <img src={img} alt="QR ทดสอบ 1 บาท" width={96} height={96} style={{ borderRadius: 8, background: '#fff' }} />
      <span className="small muted">QR ทดสอบ ฿1 — สแกนด้วยแอปธนาคารเพื่อตรวจว่าชื่อผู้รับถูกต้อง (ไม่ต้องโอนจริง)</span>
    </div>
  ) : null;
}

/* ---------- ห้องพัก ---------- */
function RoomsCard() {
  const rooms = useStore((s) => s.ds.rooms);
  const [edit, setEdit] = useState<Room | null>(null);
  const total = rooms.filter((r) => r.isActive).reduce((s, r) => s + r.capacity, 0);
  return (
    <Card title={`ห้องพัก · รวม ${total} คน`}>
      <div className="col">
        {rooms.map((r) => (
          <button key={r.id} type="button" className="list-row" onClick={() => setEdit(r)}>
            <span className="grow" style={{ lineHeight: 1.4 }}>
              <span className="b" style={{ display: 'block', fontSize: 15 }}>
                {r.name}
              </span>
              <span className="small muted">
                {ROOM_KIND_LABEL[r.kind]} · รับ {r.capacity} คน
              </span>
            </span>
            {!r.isActive && <span className="status-pill" style={{ background: '#8A8F8B', color: '#1F2320' }}><Lock {...IC16} />ปิดใช้</span>}
            <Pencil {...IC16} color="var(--color-text-muted)" />
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ id: newId(), name: `ห้อง ${rooms.length + 1}`, kind: 'small', capacity: 4, sortOrder: rooms.length + 1, isActive: true })}>
        <Plus {...IC16} /> เพิ่มห้อง
      </button>
      {edit && <RoomSheet room={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function RoomSheet({ room, onClose }: { room: Room; onClose: () => void }) {
  const [v, setV] = useState(room);
  return (
    <Sheet onClose={onClose} label="แก้ไขห้อง">
      <div className="heading" style={{ fontSize: 20 }}>
        ห้องพัก
      </div>
      <Field label="ชื่อห้องที่ใช้จริง">
        <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </Field>
      <div className="field">
        ประเภท
        <Chips value={v.kind} onChange={(k) => setV({ ...v, kind: k })} options={[{ v: 'small', label: 'ห้องเล็ก' }, { v: 'large', label: 'ห้องใหญ่' }]} />
      </div>
      <NumRow label="รับได้" unit="คน" value={v.capacity} min={1} max={50} onChange={(n) => setV({ ...v, capacity: n })} />
      <NumRow label="ลำดับการแสดง" value={v.sortOrder} max={99} onChange={(n) => setV({ ...v, sortOrder: n })} />
      <Toggle on={v.isActive} onChange={(x) => setV({ ...v, isActive: x })} title="เปิดใช้ห้องนี้" desc="ปิดถาวร เช่น ปรับปรุงยาว (ปิดชั่วคราวใช้ ปิดห้อง/ปิดวัน)" />
      <button type="button" className="btn btn-primary btn-lg" disabled={!v.name.trim()} onClick={() => { save('rooms', { ...v, name: v.name.trim() }, { summary: `แก้ไขห้อง ${v.name}` }); toast('บันทึกห้องแล้ว'); onClose(); }}>
        บันทึก
      </button>
    </Sheet>
  );
}

/* ---------- ปิดห้อง / ปิดวัน (FR-09) ---------- */
function ClosuresCard() {
  const ds = useStore((s) => s.ds);
  const [adding, setAdding] = useState(false);
  const today = todayISO();
  const list = ds.closures.filter((c) => c.end >= addDays(today, -30)).sort((a, b) => a.start.localeCompare(b.start));
  return (
    <Card title="ปิดห้อง / ปิดวัน" desc="ซ่อมแซม หรือวันหยุดของร้าน · ช่วงที่ปิดจะจองไม่ได้และแสดงลายเส้นทแยงบนปฏิทิน">
      {list.map((c) => (
        <div key={c.id} className="row divider" style={{ paddingTop: 8 }}>
          <span className="icon-tile hatch">
            <Lock {...IC16} />
          </span>
          <span className="grow" style={{ lineHeight: 1.4 }}>
            <span className="b" style={{ display: 'block', fontSize: 15 }}>
              {c.roomId ? ds.rooms.find((r) => r.id === c.roomId)?.name : 'ทั้งโฮมสเตย์'} · {fmtRange(c.start, addDays(c.end, 0))}
            </span>
            <span className="small muted">{c.reason || 'ไม่ระบุเหตุผล'}</span>
          </span>
          <button
            type="button"
            className="icon-btn plain"
            aria-label="ยกเลิกการปิด"
            onClick={async () => {
              if (await confirmDialog({ title: 'เปิดให้จองอีกครั้ง?', body: `ยกเลิกการปิด ${fmtRange(c.start, c.end)}`, yes: 'เปิดให้จอง' })) {
                remove('closures', c.id, { summary: 'ยกเลิกการปิดห้อง/วัน' });
                toast('เปิดให้จองแล้ว');
              }
            }}
          >
            <Trash {...IC16} />
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
        <Plus {...IC16} /> ปิดห้อง / ปิดวัน
      </button>
      {adding && <ClosureSheet onClose={() => setAdding(false)} />}
    </Card>
  );
}

function ClosureSheet({ onClose }: { onClose: () => void }) {
  const rooms = useStore((s) => s.ds.rooms);
  const [v, setV] = useState<Closure>({ id: newId(), roomId: null, start: todayISO(), end: todayISO(), reason: '' });
  return (
    <Sheet onClose={onClose} label="ปิดห้อง / ปิดวัน">
      <div className="heading" style={{ fontSize: 20 }}>
        ปิดห้อง / ปิดวัน
      </div>
      <div className="field">
        ปิดอะไร
        <Chips value={v.roomId ?? ''} onChange={(id) => setV({ ...v, roomId: id || null })} options={[{ v: '', label: 'ทั้งโฮมสเตย์' }, ...rooms.filter((r) => r.isActive).map((r) => ({ v: r.id, label: r.name }))]} />
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="ตั้งแต่คืนวันที่">
          <input className="input" type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value, end: e.target.value > v.end ? e.target.value : v.end })} />
        </Field>
        <Field label="ถึงคืนวันที่ (รวมวันนี้)">
          <input className="input" type="date" value={v.end} min={v.start} onChange={(e) => setV({ ...v, end: e.target.value })} />
        </Field>
      </div>
      <Field label="เหตุผล">
        <input className="input" value={v.reason} onChange={(e) => setV({ ...v, reason: e.target.value })} placeholder="เช่น ซ่อมหลังคา, หยุดประจำปี" />
      </Field>
      <button type="button" className="btn btn-primary btn-lg" disabled={!v.start || !v.end || v.end < v.start} onClick={() => { save('closures', v, { summary: `ปิด${v.roomId ? rooms.find((r) => r.id === v.roomId)?.name : 'ทั้งโฮมสเตย์'} ${fmtRange(v.start, v.end)}` }); toast('บันทึกการปิดแล้ว'); onClose(); }}>
        บันทึก
      </button>
    </Sheet>
  );
}

/* ---------- ราคาพิเศษ (feature #7) ---------- */
function PriceRulesCard() {
  const rules = useStore((s) => s.ds.priceRules);
  const [edit, setEdit] = useState<PriceRule | null>(null);
  return (
    <Card title="ราคาพิเศษ / โปรโมชั่น" desc="ราคาช่วงเทศกาล หรือส่วนลดกลุ่มใหญ่ · ใช้กับการจองใหม่">
      {[...rules].sort((a, b) => b.start.localeCompare(a.start)).map((r) => (
        <button key={r.id} type="button" className="list-row" onClick={() => setEdit(r)} style={{ opacity: r.isActive ? 1 : 0.55 }}>
          <span className="grow" style={{ lineHeight: 1.4 }}>
            <span className="b" style={{ display: 'block', fontSize: 15 }}>
              {r.name}
            </span>
            <span className="small muted">
              {fmtRange(r.start, r.end)} · {r.pricePerPerson != null ? `${fmtBaht(r.pricePerPerson)}/คน/คืน` : ''}
              {r.discountPct ? ` ลด ${r.discountPct}%` : ''}
              {r.minGuests ? ` · ตั้งแต่ ${r.minGuests} คน` : ''}
              {!r.isActive ? ' · ปิดใช้' : ''}
            </span>
          </span>
          <Pencil {...IC16} color="var(--color-text-muted)" />
        </button>
      ))}
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEdit({ id: newId(), name: '', start: todayISO(), end: todayISO(), pricePerPerson: null, minGuests: null, discountPct: null, isActive: true })}>
        <Plus {...IC16} /> เพิ่มราคาพิเศษ
      </button>
      {edit && <RuleSheet rule={edit} onClose={() => setEdit(null)} />}
    </Card>
  );
}

function RuleSheet({ rule, onClose }: { rule: PriceRule; onClose: () => void }) {
  const [v, setV] = useState(rule);
  const exists = useStore((s) => s.ds.priceRules.some((r) => r.id === rule.id));
  const ok = v.name.trim() && v.end >= v.start && (v.pricePerPerson != null || (v.discountPct ?? 0) > 0);
  return (
    <Sheet onClose={onClose} label="ราคาพิเศษ">
      <div className="heading" style={{ fontSize: 20 }}>
        ราคาพิเศษ
      </div>
      <Field label="ชื่อ">
        <input className="input" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="เช่น ช่วงปีใหม่, กลุ่ม 15 คนขึ้นไป" />
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="ตั้งแต่คืนวันที่">
          <input className="input" type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} />
        </Field>
        <Field label="ถึงคืนวันที่">
          <input className="input" type="date" value={v.end} min={v.start} onChange={(e) => setV({ ...v, end: e.target.value })} />
        </Field>
      </div>
      <Field label="ราคาต่อคนต่อคืน (เว้นว่าง = ใช้ราคาปกติ)">
        <MoneyInput value={v.pricePerPerson} onChange={(p) => setV({ ...v, pricePerPerson: p })} placeholder="ราคาปกติ" />
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="ส่วนลด %">
          <input className="input money" inputMode="decimal" value={v.discountPct ?? ''} onChange={(e) => { const n = parseFloat(e.target.value); setV({ ...v, discountPct: Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : null }); }} placeholder="0" />
        </Field>
        <Field label="ใช้เมื่อมาตั้งแต่ (คน)">
          <input className="input money" inputMode="numeric" value={v.minGuests ?? ''} onChange={(e) => { const n = parseInt(e.target.value, 10); setV({ ...v, minGuests: Number.isFinite(n) && n > 0 ? n : null }); }} placeholder="ทุกกลุ่ม" />
        </Field>
      </div>
      <Toggle on={v.isActive} onChange={(x) => setV({ ...v, isActive: x })} title="เปิดใช้" />
      <div className="small muted">ถ้ามีหลายกฎซ้อนช่วงกัน ระบบใช้ราคาของกฎที่ช่วงวันสั้นที่สุด และใช้ส่วนลด % ที่มากที่สุด (ไม่ทบกัน)</div>
      <div className="row gap8">
        {exists && (
          <button type="button" className="btn btn-ghost" onClick={() => { remove('priceRules', v.id, { summary: `ลบราคาพิเศษ ${v.name}` }); onClose(); }}>
            <Trash {...IC16} />
          </button>
        )}
        <button type="button" className="btn btn-primary btn-lg grow" disabled={!ok} onClick={() => { save('priceRules', { ...v, name: v.name.trim() }, { summary: `บันทึกราคาพิเศษ ${v.name}` }); toast('บันทึกราคาพิเศษแล้ว'); onClose(); }}>
          บันทึก
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- ต้นทุนคงที่รายเดือน ---------- */
function FixedCostsCard() {
  const items = useStore((s) => s.ds.fixedCosts);
  const ym = todayISO().slice(0, 7);
  const current = items.filter((f) => f.effectiveFrom <= ym && (!f.effectiveTo || f.effectiveTo >= ym));
  const [name, setName] = useState('');
  return (
    <Card title="ต้นทุนคงที่รายเดือน" desc="นำไปหักกำไรใน Dashboard (เฉลี่ยตามจำนวนวัน) · เปลี่ยนยอดแล้วมีผลตั้งแต่เดือนนี้">
      {current.map((f) => (
        <div key={f.id} className="row" style={{ gap: 12 }}>
          <span className="grow b" style={{ fontSize: 15 }}>
            {f.name}
          </span>
          <span className={`b num ${f.amount ? '' : 'muted'}`}>{f.amount ? fmtBaht(f.amount) : 'ยังไม่ระบุ'}</span>
          <FixedEditor id={f.id} />
        </div>
      ))}
      <div className="row gap8">
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="เพิ่มรายการ เช่น ค่าแก๊ส" aria-label="ชื่อรายการต้นทุนคงที่" />
        <button type="button" className="btn btn-ghost btn-sm" disabled={!name.trim()} onClick={() => { save('fixedCosts', { id: newId(), name: name.trim(), amount: 0, effectiveFrom: ym, effectiveTo: null }); setName(''); }}>
          <Plus {...IC16} />
        </button>
      </div>
    </Card>
  );
}

/** แก้ยอดต้นทุนคงที่: ถ้ามีผลมาก่อนเดือนนี้ ปิดรายการเดิมที่เดือนก่อน แล้วเริ่มยอดใหม่เดือนนี้ (ตัวเลขย้อนหลังไม่เปลี่ยน) */
function FixedEditor({ id }: { id: string }) {
  const f = useStore((s) => s.ds.fixedCosts.find((x) => x.id === id));
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState<number | null>(f?.amount || null);
  if (!f) return null;
  const ym = todayISO().slice(0, 7);
  return (
    <>
      <button type="button" className="icon-btn plain" aria-label={`แก้ไข ${f.name}`} onClick={() => setOpen(true)}>
        <Pencil {...IC16} />
      </button>
      {open && (
        <Sheet onClose={() => setOpen(false)} label={f.name}>
          <div className="heading" style={{ fontSize: 20 }}>
            {f.name}
          </div>
          <Field label="ยอดต่อเดือน (บาท)">
            <MoneyInput value={amt} onChange={setAmt} placeholder="ยังไม่ระบุ" />
          </Field>
          <div className="small muted">มีผลตั้งแต่เดือนนี้ เดือนก่อนหน้ายังใช้ยอดเดิม</div>
          <div className="row gap8">
            <button
              type="button"
              className="btn btn-ghost"
              aria-label="หยุดใช้รายการนี้"
              onClick={() => {
                const prev = ym === f.effectiveFrom ? null : prevYm(ym);
                if (prev) save('fixedCosts', { ...f, effectiveTo: prev });
                else remove('fixedCosts', f.id);
                setOpen(false);
              }}
            >
              <Trash {...IC16} />
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg grow"
              onClick={() => {
                const amount = amt ?? 0;
                if (f.effectiveFrom === ym || f.amount === 0) save('fixedCosts', { ...f, amount, effectiveFrom: f.amount === 0 ? f.effectiveFrom : ym });
                else {
                  save('fixedCosts', { ...f, effectiveTo: prevYm(ym) });
                  save('fixedCosts', { id: newId(), name: f.name, amount, effectiveFrom: ym, effectiveTo: null });
                }
                toast('บันทึกแล้ว');
                setOpen(false);
              }}
            >
              บันทึก
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}

function prevYm(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y! - 1}-12` : `${y}-${String(m! - 1).padStart(2, '0')}`;
}

/* ---------- หมวดค่าใช้จ่าย ---------- */
function CategoriesCard() {
  const cats = useStore((s) => s.ds.categories);
  const used = useStore((s) => new Set(s.ds.issues.map((i) => i.categoryId)));
  const [name, setName] = useState('');
  return (
    <Card title="หมวดค่าใช้จ่าย">
      <div className="chips">
        {cats.map((c) => (
          <span key={c.id} className="chip" style={{ cursor: 'default' }}>
            {c.name}
            {!used.has(c.id) && (
              <button type="button" aria-label={`ลบหมวด ${c.name}`} onClick={() => remove('categories', c.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--color-text-muted)' }}>
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      <div className="row gap8">
        <input className="input grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="เพิ่มหมวด" aria-label="ชื่อหมวดใหม่" />
        <button type="button" className="btn btn-ghost btn-sm" disabled={!name.trim()} onClick={() => { save('categories', { id: newId(), name: name.trim(), sortOrder: cats.length + 1 }); setName(''); }}>
          <Plus {...IC16} />
        </button>
      </div>
    </Card>
  );
}

/* ---------- ผู้ใช้งาน ---------- */
interface UserRow extends UserInfo {
  disabled: boolean;
  devices: number;
}
function UsersCard({ me }: { me: UserInfo }) {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [pw, setPw] = useState<UserRow | null>(null);
  const load = () => void api<{ users: UserRow[] }>('/api/users').then((r) => setUsers(r.users)).catch(() => setUsers(null));
  useEffect(load, []);
  return (
    <Card title="ผู้ใช้งาน" desc="ทุกคนเห็นข้อมูลเท่ากัน · เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่าน">
      {users === null && <div className="small muted">ต้องต่ออินเทอร์เน็ตเพื่อดูรายชื่อผู้ใช้</div>}
      {users?.map((u) => (
        <div key={u.id} className="row divider" style={{ paddingTop: 8, opacity: u.disabled ? 0.5 : 1 }}>
          <Smartphone {...IC} />
          <span className="grow" style={{ lineHeight: 1.4 }}>
            <span className="b" style={{ display: 'block', fontSize: 15 }}>
              {u.displayName} {u.id === me.id && <span className="small muted">(คุณ)</span>}
            </span>
            <span className="small muted">
              {u.username} · {u.role === 'owner' ? 'เจ้าของกิจการ' : 'พนักงาน'} · เข้าสู่ระบบอยู่ {u.devices} เครื่อง{u.disabled ? ' · ปิดบัญชี' : ''}
            </span>
          </span>
          {(u.id === me.id || me.role === 'owner') && (
            <button type="button" className="icon-btn plain" aria-label={`เปลี่ยนรหัสผ่าน ${u.displayName}`} onClick={() => setPw(u)}>
              <KeyRound {...IC16} />
            </button>
          )}
        </div>
      ))}
      {me.role === 'owner' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
          <UserPlus {...IC16} /> เพิ่มผู้ใช้
        </button>
      )}
      {adding && <AddUser onClose={() => { setAdding(false); load(); }} />}
      {pw && <PasswordSheet u={pw} me={me} onClose={() => { setPw(null); load(); }} />}
    </Card>
  );
}

function AddUser({ onClose }: { onClose: () => void }) {
  const [v, setV] = useState({ username: '', displayName: '', password: '', role: 'staff' as 'owner' | 'staff' });
  const [err, setErr] = useState('');
  return (
    <Sheet onClose={onClose} label="เพิ่มผู้ใช้">
      <div className="heading" style={{ fontSize: 20 }}>
        เพิ่มผู้ใช้
      </div>
      <Field label="ชื่อที่แสดง">
        <input className="input" value={v.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} placeholder="เช่น พี่แดง" />
      </Field>
      <Field label="ชื่อผู้ใช้ (a–z, 0–9)">
        <input className="input" autoCapitalize="none" value={v.username} onChange={(e) => setV({ ...v, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} />
      </Field>
      <Field label="รหัสผ่าน (อย่างน้อย 8 ตัว)">
        <input className="input" type="text" autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
      </Field>
      <Chips value={v.role} onChange={(r) => setV({ ...v, role: r })} options={[{ v: 'staff', label: 'พนักงาน' }, { v: 'owner', label: 'เจ้าของกิจการ' }]} />
      {err && <div className="alert">{err}</div>}
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={v.username.length < 3 || v.password.length < 8}
        onClick={async () => {
          try {
            await api('/api/users', { body: v });
            toast('เพิ่มผู้ใช้แล้ว');
            onClose();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'เพิ่มผู้ใช้ไม่สำเร็จ');
          }
        }}
      >
        เพิ่มผู้ใช้
      </button>
    </Sheet>
  );
}

function PasswordSheet({ u, me, onClose }: { u: UserRow; me: UserInfo; onClose: () => void }) {
  const self = u.id === me.id;
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  return (
    <Sheet onClose={onClose} label="เปลี่ยนรหัสผ่าน">
      <div className="heading" style={{ fontSize: 20 }}>
        เปลี่ยนรหัสผ่าน · {u.displayName}
      </div>
      {self && (
        <Field label="รหัสผ่านเดิม">
          <input className="input" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        </Field>
      )}
      <Field label="รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)">
        <input className="input" type="text" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
      </Field>
      <div className="small muted">เครื่องอื่นที่เข้าสู่ระบบด้วยบัญชีนี้จะถูกออกจากระบบ</div>
      {err && <div className="alert">{err}</div>}
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={pw.length < 8}
        onClick={async () => {
          try {
            await api(`/api/users/${u.id}/password`, { body: { password: pw, current: cur } });
            toast('เปลี่ยนรหัสผ่านแล้ว');
            onClose();
          } catch (e) {
            setErr(e instanceof ApiError ? e.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
          }
        }}
      >
        บันทึกรหัสผ่านใหม่
      </button>
      {!self && me.role === 'owner' && (
        <button
          type="button"
          className="btn btn-text danger"
          onClick={async () => {
            if (await confirmDialog({ title: u.disabled ? 'เปิดบัญชีนี้อีกครั้ง?' : 'ปิดบัญชีนี้?', body: u.disabled ? '' : 'ผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ และถูกออกจากทุกเครื่องทันที', yes: u.disabled ? 'เปิดบัญชี' : 'ปิดบัญชี', danger: !u.disabled })) {
              await api(`/api/users/${u.id}/${u.disabled ? 'enable' : 'disable'}`, { method: 'POST' }).catch((e) => toast(String((e as Error).message), { kind: 'error' }));
              onClose();
            }
          }}
        >
          {u.disabled ? 'เปิดบัญชี' : 'ปิดบัญชีผู้ใช้นี้'}
        </button>
      )}
    </Sheet>
  );
}

/* ---------- การแจ้งเตือน ---------- */
function NotifyCard({ draft, set }: { draft: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const vapid = useStore((s) => s.vapidPublicKey);
  const device = useStore((s) => s.device);
  const [ps, setPs] = useState<string>('…');
  const [line, setLine] = useState<{ configured: boolean; recipients: number; webhook: string } | null>(null);
  const [code, setCode] = useState('');
  const refresh = () => void pushState().then(setPs);
  useEffect(() => {
    refresh();
    void api<{ configured: boolean; recipients: number; webhook: string }>('/api/line/status').then(setLine).catch(() => {});
  }, []);
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return (
    <Card title={<span className="row" style={{ gap: 8 }}><Bell {...IC} />การแจ้งเตือน</span>} desc="แจ้งการจองใหม่/แก้ยอดเงินให้อีกเครื่องทันที · สรุปแขกพรุ่งนี้ตอนเย็น · มัดจำครบกำหนดตอนเช้า">
      <div className="row" style={{ gap: 12 }}>
        <span className="grow" style={{ lineHeight: 1.4 }}>
          <span className="b" style={{ display: 'block', fontSize: 15 }}>
            แจ้งเตือนบนเครื่องนี้
          </span>
          <span className="small muted">
            {ps === 'on' ? 'เปิดอยู่' : ps === 'off' ? 'ยังไม่เปิด' : ps === 'denied' ? 'ถูกปิดในการตั้งค่าของเครื่อง' : ps === 'need-install' ? 'iPhone/iPad ต้องติดตั้งแอปลงหน้าจอก่อน' : ps === 'unsupported' ? 'เบราว์เซอร์นี้ไม่รองรับ' : '…'}
          </span>
        </span>
        {ps === 'on' ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await disablePush(); refresh(); }}>
            ปิด
          </button>
        ) : ps === 'need-install' ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => open({ k: 'install' })}>
            วิธีติดตั้ง
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={ps !== 'off'}
            onClick={async () => {
              try {
                await enablePush(vapid, device);
                toast('เปิดการแจ้งเตือนแล้ว');
              } catch (e) {
                toast((e as Error).message, { kind: 'error' });
              }
              refresh();
            }}
          >
            เปิดการแจ้งเตือน
          </button>
        )}
      </div>
      {ps === 'on' && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => api('/api/push/test', { method: 'POST' }).then(() => toast('ส่งแจ้งเตือนทดสอบแล้ว')).catch((e) => toast((e as Error).message, { kind: 'error' }))}>
          ส่งแจ้งเตือนทดสอบ
        </button>
      )}
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="สรุปยอดเงินตอนเช้า">
          <select className="select" value={draft.notifyMorningHour} onChange={(e) => set('notifyMorningHour', Number(e.target.value))}>
            {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </Field>
        <Field label="สรุปแขกพรุ่งนี้ตอนเย็น">
          <select className="select" value={draft.notifyEveningHour} onChange={(e) => set('notifyEveningHour', Number(e.target.value))}>
            {hours.map((h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
          </select>
        </Field>
      </div>
      <div className="divider" style={{ paddingTop: 10 }}>
        <div className="b" style={{ fontSize: 15 }}>
          LINE Official Account (ไม่บังคับ)
        </div>
        {!line ? (
          <div className="small muted">ต้องต่ออินเทอร์เน็ตเพื่อดูสถานะ</div>
        ) : !line.configured ? (
          <div className="small muted">ยังไม่ได้เชื่อม LINE OA — ดูวิธีตั้งค่าในคู่มือดูแลระบบ (ฟรี 300 ข้อความ/เดือน ใช้สำหรับสรุปรายวันเท่านั้น)</div>
        ) : (
          <div className="col gap8">
            <div className="small muted">เชื่อมแล้ว · แชทที่รับสรุป {line.recipients} แชท</div>
            <Toggle on={draft.lineDigest} onChange={(v) => set('lineDigest', v)} title="ส่งสรุปแขกพรุ่งนี้ทาง LINE" />
            {code ? (
              <div className="alert info">
                พิมพ์ <b>ลงทะเบียน {code}</b> ในแชท LINE OA ของร้าน (ภายใน 30 นาที)
              </div>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => api<{ code: string }>('/api/line/code', { method: 'POST' }).then((r) => setCode(r.code))}>
                ขอรหัสลงทะเบียนแชท
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => api('/api/line/test', { method: 'POST' }).then(() => toast('ส่งข้อความทดสอบทาง LINE แล้ว')).catch((e) => toast((e as Error).message, { kind: 'error' }))}>
              ส่งข้อความทดสอบ
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------- ข้อมูล การซิงก์ สำรองข้อมูล ---------- */
function DataCard({ me }: { me: UserInfo }) {
  const st = useStore((s) => ({ online: s.online, pending: s.pending, lastSyncAt: s.lastSyncAt }));
  const ds = useStore((s) => s.ds);
  const [info, setInfo] = useState<{ backups: Array<{ id: string; at: string; rows: number; size: number }>; usage: { files: number; fileBytes: number; records: number } } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => void api<NonNullable<typeof info>>('/api/backups').then(setInfo).catch(() => {});
  useEffect(load, []);
  const last = info?.backups[0];
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  const used = info ? info.usage.fileBytes : 0;
  const LIMIT = 450 * 1024 * 1024;
  return (
    <Card title={<span className="row" style={{ gap: 8 }}><Database {...IC} />ข้อมูลและการซิงก์</span>}>
      <div className="row" style={{ gap: 12 }}>
        <span className="grow" style={{ lineHeight: 1.4 }}>
          <span className="b" style={{ display: 'block', fontSize: 15 }}>
            {st.online ? (st.pending ? `รอซิงก์ ${st.pending} รายการ` : 'ซิงก์ครบแล้ว') : `ออฟไลน์ · รอซิงก์ ${st.pending} รายการ`}
          </span>
          <span className="small muted">{st.lastSyncAt ? `ตรวจล่าสุด ${fmtDateTime(new Date(st.lastSyncAt).toISOString())}` : 'ยังไม่ได้ซิงก์'} · ข้อมูลอยู่ในเครื่องนี้ด้วย ใช้ได้แม้เน็ตหลุด</span>
        </span>
        <button type="button" className="icon-btn plain" aria-label="ซิงก์ตอนนี้" onClick={() => { syncNow(); toast('กำลังซิงก์'); }}>
          <RefreshCw {...IC} />
        </button>
      </div>
      <div className="row divider" style={{ gap: 12, paddingTop: 10 }}>
        <span className="grow" style={{ lineHeight: 1.4 }}>
          <span className="b" style={{ display: 'block', fontSize: 15 }}>
            สำรองข้อมูลอัตโนมัติทุกวัน 03:00
          </span>
          <span className="small muted">{last ? `ล่าสุด ${fmtDateTime(last.at)} · เก็บ ${info!.backups.length} ชุด` : 'ยังไม่มีไฟล์สำรอง'}</span>
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => api('/api/backups/run', { method: 'POST' }).then(() => { toast('สำรองข้อมูลแล้ว'); load(); }).catch((e) => toast((e as Error).message, { kind: 'error' }))}>
          สำรองตอนนี้
        </button>
      </div>
      {info && info.backups.length > 0 && (
        <details>
          <summary className="small b" style={{ cursor: 'pointer', minHeight: 32 }}>
            ไฟล์สำรองย้อนหลัง
          </summary>
          <div className="col">
            {info.backups.map((b) => (
              <a key={b.id} className="list-row small" href={`/api/backups/${b.id}`} download style={{ color: 'var(--color-text)', textDecoration: 'none' }}>
                <span className="grow">{fmtDate(b.id)}</span>
                <span className="muted">{b.rows} รายการ</span>
                <Download {...IC16} />
              </a>
            ))}
          </div>
        </details>
      )}
      {info && (
        <div className="small muted">
          รูปสลิป/รูปปัญหา {info.usage.files} รูป ({mb(used)}) · ข้อมูล {info.usage.records} รายการ
          {used > LIMIT * 0.8 && <div className="alert warn" style={{ marginTop: 6 }}>พื้นที่เก็บรูปใกล้เต็ม (เกิน 80%) ควรดาวน์โหลดข้อมูลทั้งหมดเก็บไว้</div>}
        </div>
      )}
      <div className="small muted">ส่งออกข้อมูลทั้งหมดเก็บไว้เองเดือนละครั้ง</div>
      <div className="row wrap gap8">
        <a className="btn btn-secondary btn-sm" href="/api/export.json" download>
          <Download {...IC16} /> JSON (กู้คืนได้)
        </a>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => exportAllExcel(ds)}>
          <Download {...IC16} /> Excel
        </button>
        {me.role === 'owner' && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                if (!(await confirmDialog({ title: 'กู้คืนข้อมูลจากไฟล์?', body: `ข้อมูลปัจจุบันทั้งหมดจะถูกแทนด้วยไฟล์ "${f.name}" (ระบบสำรองข้อมูลปัจจุบันไว้ให้ก่อนอัตโนมัติ) ทุกเครื่องจะโหลดข้อมูลใหม่`, yes: 'กู้คืน', danger: true }))) return;
                try {
                  await api('/api/restore', { raw: await f.text(), headers: { 'Content-Type': 'application/json' }, timeoutMs: 120000 });
                  toast('กู้คืนข้อมูลแล้ว');
                  syncNow();
                } catch (err) {
                  toast((err as Error).message, { kind: 'error' });
                }
              }}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload {...IC16} /> กู้คืนจากไฟล์
            </button>
          </>
        )}
      </div>
      {!isStandalone() && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => open({ k: 'install' })}>
          <Download {...IC16} /> ติดตั้งแอปลงหน้าจอ
        </button>
      )}
      <button
        type="button"
        className="btn btn-ghost"
        onClick={async () => {
          const pending = getState().pending;
          if (pending && !(await confirmDialog({ title: 'ยังมีข้อมูลรอซิงก์', body: `${pending} รายการยังไม่ขึ้นเซิร์ฟเวอร์ ถ้าออกจากระบบตอนนี้ข้อมูลนี้จะหาย`, yes: 'ออกจากระบบ', danger: true }))) return;
          await logout();
        }}
      >
        <LogOut {...IC} />
        ออกจากระบบ
      </button>
    </Card>
  );
}

