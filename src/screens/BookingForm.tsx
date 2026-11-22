/** 4. จองใหม่ / แก้ไข / เลื่อนวัน — 4 ขั้น: วันที่ → ห้อง/คน → ลูกค้า → ชำระเงิน (FR-03, FR-04, FR-05) */
import { useMemo, useRef, useState } from 'react';
import { Car, Check, CircleCheck, ChevronLeft, ChevronRight, Circle, Camera, Search, TriangleExclamationPoint } from 'lucide-react';
import { useStore, save, newId, addImage, getState } from '../lib/store';
import { close, replaceTop, type BookingFormInit } from '../app/nav';
import { recordPayment } from '../app/actions';
import { PILL } from '../app/derive';
import { Chips, CloseBtn, Field, HalfCircle, IC, IC16, MoneyInput, Stepper, Toggle, toast, confirmDialog } from '../app/ui';
import { addDays, addMonths, dayOfWeek, daysInclusive, endOfMonth, fmtDate, fmtMonth, fmtRange, nightsOf, startOfMonth, TH_DAYS_SHORT, todayISO } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { activeRooms, autoAllocate, checkBooking, dayFree, houseCapacity, minDayFree, minRoomFree, roomEmptyAllNights } from '../domain/capacity';
import { bookingDeposit, depositFor, depositOf, depositRuleText, quote, totalFromNightly } from '../domain/pricing';
import { CHANNEL_LABEL, METHOD_LABEL, ROOM_KIND_LABEL, STAFF_CHANNELS } from '../domain/defaults';
import type { Booking, Channel, Customer, PayMethod, PayStatus, Satang } from '../domain/types';

const STEPS = ['วันที่', 'ห้อง / คน', 'ลูกค้า', 'ชำระเงิน'];

export function BookingForm({ init }: { init: BookingFormInit }) {
  const ds = useStore((s) => s.ds);
  const st = ds.settings;
  const today = todayISO();
  const editing = init.editId ? ds.bookings.find((b) => b.id === init.editId) : undefined;
  const request = init.requestId ? ds.requests.find((r) => r.id === init.requestId) : undefined;
  const preCustomer = init.customerId ? ds.customers.find((c) => c.id === init.customerId) : undefined;

  const [step, setStep] = useState(editing && !init.reschedule ? 1 : init.checkIn && !init.checkOut ? 0 : init.checkIn && init.checkOut ? 1 : 0);
  const [reached, setReached] = useState(editing ? 3 : init.checkIn && init.checkOut ? 1 : 0);
  const [checkIn, setCheckIn] = useState<string | null>(editing?.checkIn ?? request?.checkIn ?? init.checkIn ?? null);
  const [checkOut, setCheckOut] = useState<string | null>(editing?.checkOut ?? request?.checkOut ?? init.checkOut ?? (init.checkIn ? addDays(init.checkIn, 1) : null));
  const [month, setMonth] = useState(startOfMonth(checkIn ?? today));
  const [adults, setAdults] = useState(editing?.adults ?? request?.adults ?? 2);
  const [children, setChildren] = useState(editing?.children ?? request?.children ?? 0);
  const [selRooms, setSelRooms] = useState<string[]>(editing?.rooms.map((r) => r.roomId) ?? []);
  const [whole, setWhole] = useState<Set<string>>(new Set(editing?.rooms.filter((r) => r.whole).map((r) => r.roomId) ?? []));
  const [manual, setManual] = useState<Record<string, number> | null>(editing ? Object.fromEntries(editing.rooms.map((r) => [r.roomId, r.guests])) : null);
  const [usesTransport, setUsesTransport] = useState(editing?.usesTransport ?? false);
  const [pickupPoint, setPickupPoint] = useState(editing?.pickupPoint ?? '');
  const [pickupTime, setPickupTime] = useState(editing?.pickupTime ?? '');
  const [customerId, setCustomerId] = useState<string | null>(editing?.customerId ?? preCustomer?.id ?? null);
  const [name, setName] = useState(editing?.name ?? request?.name ?? preCustomer?.name ?? '');
  const [phone, setPhone] = useState(editing?.phone ?? request?.phone ?? preCustomer?.phone ?? '');
  const [lineId, setLineId] = useState(editing?.lineId ?? request?.lineId ?? preCustomer?.lineId ?? '');
  const [allergies, setAllergies] = useState(editing?.allergies ?? preCustomer?.allergies ?? '');
  const [channel, setChannel] = useState<Channel>(editing?.channel ?? (request ? 'online' : 'line'));
  const [notes, setNotes] = useState(editing?.notes ?? (request?.message ? `ข้อความจากลูกค้า: ${request.message}` : ''));
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState<Satang>(editing?.discount ?? 0);
  const [extra, setExtra] = useState<Satang>(editing?.extra ?? 0);
  const [extraNote, setExtraNote] = useState(editing?.extraNote ?? '');
  const [showAdj, setShowAdj] = useState(!!(editing?.discount || editing?.extra));
  // มัดจำ: เลือกได้ว่าเป็น % หรือจำนวนเงิน (ค่าเริ่มต้นตามตั้งค่า แก้เฉพาะการจองนี้ได้)
  const [depMode, setDepMode] = useState<'percent' | 'amount'>(editing ? (typeof editing.deposit === 'number' ? 'amount' : 'percent') : st.depositMode === 'percent' ? 'percent' : 'amount');
  const [depPctInput, setDepPctInput] = useState<number>(editing?.depositPct ?? st.depositPct);
  const [depAmtInput, setDepAmtInput] = useState<Satang | null>(null);
  const [payStatus, setPayStatus] = useState<PayStatus>('unpaid');
  const [method, setMethod] = useState<PayMethod>('transfer');
  const [slip, setSlip] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const guests = adults + children;
  const nights = checkIn && checkOut ? nightsOf(checkIn, checkOut) : [];
  const ctx = { rooms: ds.rooms, bookings: ds.bookings, closures: ds.closures };
  const cap = houseCapacity(ds.rooms);
  const rooms = activeRooms(ds.rooms);
  const excl = editing?.id;
  const freeByRoom = useMemo(() => new Map(rooms.map((r) => [r.id, minRoomFree(nights, r, ctx, excl)])), [rooms, nights.join(), ds.bookings, ds.closures, excl]); // eslint-disable-line
  const isWhole = (id: string) => (st.bookingMode === 'room' ? true : st.bookingMode === 'person' ? false : whole.has(id));
  const alloc = manual && selRooms.every((id) => id in manual) && selRooms.reduce((s, id) => s + (manual[id] ?? 0), 0) === guests
    ? selRooms.map((id) => ({ roomId: id, guests: manual[id] ?? 0, whole: isWhole(id) }))
    : autoAllocate(selRooms, guests, freeByRoom, isWhole);
  const errors = checkIn && checkOut && selRooms.length ? checkBooking({ id: excl, checkIn, checkOut, guests, rooms: alloc }, ctx) : [];
  const houseFree = nights.length ? minDayFree(nights, ctx, excl) : cap;

  // ราคา: แก้ไขโดยวันที่/จำนวนคนเดิม → ใช้ราคา ณ วันจองเดิม
  const samePricing = editing && editing.checkIn === checkIn && editing.checkOut === checkOut && editing.adults + editing.children === guests;
  const q = checkIn && checkOut ? quote({ checkIn, checkOut, adults, children, discount, extra, bookedOn: today }, st, ds.priceRules) : null;
  const nightly = samePricing ? editing!.nightly : (q?.nightly ?? []);
  const total = nightly.length ? totalFromNightly(nightly, guests, discount, extra) : 0;
  const autoDeposit = editing && editing.total === total ? bookingDeposit(editing) : depositFor(total, guests, st);
  const deposit = Math.min(total, depMode === 'percent' ? depositOf(total, depPctInput) : (depAmtInput ?? autoDeposit));
  const depositDueOn = editing?.depositDueOn ?? addDays(today, st.depositDueDays);
  const uniform = nightly.length > 0 && nightly.every((n) => n.price === nightly[0]!.price);
  const calc = !nightly.length ? '' : uniform ? `${fmtBaht(nightly[0]!.price)} × ${guests} คน × ${nightly.length} คืน` : `ค่าที่พัก ${nightly.length} คืน (มีราคาพิเศษ)`;
  const paidNow = payStatus === 'deposit' ? deposit : payStatus === 'paid' ? total : 0;
  const roomLabel = alloc.map((a) => ds.rooms.find((r) => r.id === a.roomId)?.name).join(', ');
  const summary = [guests ? `${guests} คน` : '', nights.length ? `${nights.length} คืน` : '', roomLabel].filter(Boolean).join(' · ');

  const stepOk = [!!checkIn && !!checkOut && nights.length > 0, guests > 0 && selRooms.length > 0 && errors.length === 0, name.trim().length > 0 && phone.replace(/\D/g, '').length >= 9, true];
  const canNext = stepOk[step]!;

  const suggestions = useMemo(() => {
    const t = search.trim().toLowerCase().replace(/[-\s]/g, '');
    if (t.length < 2) return [] as Array<Customer & { visits: number }>;
    return ds.customers
      .filter((c) => c.name.toLowerCase().replace(/\s/g, '').includes(t) || c.phone.replace(/\D/g, '').includes(t))
      .slice(0, 6)
      .map((c) => ({ ...c, visits: ds.bookings.filter((b) => b.customerId === c.id && b.status !== 'cancelled').length }));
  }, [search, ds.customers, ds.bookings]);

  function pickDay(d: string) {
    if (!checkIn || (checkIn && checkOut) || d <= checkIn) {
      setCheckIn(d);
      setCheckOut(null);
    } else {
      setCheckOut(d);
    }
  }

  function toggleRoom(id: string) {
    setManual(null);
    setSelRooms((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function goStep(n: number) {
    setStep(n);
    setReached((r) => Math.max(r, n));
    document.querySelector('.overlay-body')?.scrollTo({ top: 0 });
  }

  async function onSave() {
    if (saving) return;
    if (!checkIn || !checkOut) return goStep(0);
    if (!stepOk[1]) return goStep(1);
    if (!stepOk[2]) return goStep(2);
    if (init.reschedule && editing && editing.rescheduleCount >= st.rescheduleLimit) {
      const ok = await confirmDialog({ title: 'เลื่อนวันครบตามนโยบายแล้ว', body: `การจองนี้เลื่อนวันไปแล้ว ${editing.rescheduleCount} ครั้ง (นโยบายเลื่อนได้ ${st.rescheduleLimit} ครั้ง) ต้องการเลื่อนอีกครั้งหรือไม่`, yes: 'เลื่อนวัน' });
      if (!ok) return;
    }
    setSaving(true);
    // ลูกค้า: ใช้รายเดิม (อัปเดตข้อมูลติดต่อ) หรือสร้างใหม่ (ถ้าเบอร์ตรงกับรายเดิมใช้รายเดิม)
    const digits = phone.replace(/\D/g, '');
    let cust = customerId ? ds.customers.find((c) => c.id === customerId) : ds.customers.find((c) => c.phone.replace(/\D/g, '') === digits && digits.length >= 9);
    const custData = { name: name.trim(), phone: phone.trim(), lineId: lineId.trim(), allergies: allergies.trim() };
    if (!cust) {
      cust = { id: newId(), ...custData, notes: '', isRegular: false, createdAt: new Date().toISOString() };
      save('customers', cust);
    } else if (cust.name !== custData.name || cust.phone !== custData.phone || cust.lineId !== custData.lineId || (custData.allergies && cust.allergies !== custData.allergies)) {
      save('customers', { ...cust, ...custData, allergies: custData.allergies || cust.allergies });
    }
    const datesChanged = editing && (editing.checkIn !== checkIn || editing.checkOut !== checkOut);
    const b: Booking = {
      ...(editing ?? {
        id: newId(),
        code: '',
        status: 'confirmed',
        depositDueOn,
        mealCost: st.mealCost,
        transportCost: st.transportCost,
        rescheduleCount: 0,
        cancelledOn: null,
        checkedInAt: null,
        checkedOutAt: null,
        surveyToken: '',
        createdBy: getState().user?.displayName ?? '',
        createdAt: new Date().toISOString(),
      }),
      customerId: cust.id,
      name: custData.name,
      phone: custData.phone,
      lineId: custData.lineId,
      allergies: custData.allergies,
      checkIn,
      checkOut,
      adults,
      children,
      channel,
      rooms: alloc,
      nightly,
      discount,
      extra,
      extraNote: extraNote.trim(),
      total,
      deposit,
      usesTransport,
      pickupPoint: usesTransport ? pickupPoint.trim() : '',
      pickupTime: usesTransport ? pickupTime : '',
      notes: notes.trim(),
      rescheduleCount: (editing?.rescheduleCount ?? 0) + (init.reschedule && datesChanged ? 1 : 0),
    } as Booking;
    const summaryText = editing
      ? init.reschedule && datesChanged
        ? `เลื่อนวัน ${fmtRange(editing.checkIn, editing.checkOut)} → ${fmtRange(checkIn, checkOut)}`
        : `แก้ไขการจอง${editing.total !== total ? ` ยอด ${fmtBaht(editing.total)} → ${fmtBaht(total)}` : ''}${datesChanged ? ` วันที่ ${fmtRange(checkIn, checkOut)}` : ''}`
      : `สร้างการจอง ${fmtRange(checkIn, checkOut)} · ${guests} คน · ${fmtBaht(total)}`;
    save('bookings', b, { summary: summaryText });
    if (!editing && paidNow > 0) recordPayment(b, payStatus === 'paid' ? (paidNow >= total ? 'balance' : 'deposit') : 'deposit', paidNow, method, slip);
    if (request) save('requests', { ...request, status: 'accepted', bookingId: b.id });
    toast(editing ? 'บันทึกการแก้ไขแล้ว' : 'บันทึกการจองแล้ว');
    if (editing) close();
    else replaceTop({ k: 'booking', id: b.id });
  }

  const first = startOfMonth(month);
  const gridStart = addDays(first, -dayOfWeek(first));
  const last = endOfMonth(month);
  const cells = daysInclusive(gridStart, addDays(last, 6 - dayOfWeek(last)));
  const title = editing ? (init.reschedule ? 'เลื่อนวันเข้าพัก' : `แก้ไขการจอง ${editing.code}`) : request ? 'รับคำขอจองออนไลน์' : 'จองใหม่';

  return (
    <section className="overlay" style={{ zIndex: 45 }} aria-label={title}>
      <div className="overlay-head" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12, padding: '8px 16px 12px' }}>
        <div className="row gap8">
          <h1 style={{ flex: 1, fontSize: 24 }}>{title}</h1>
          <CloseBtn onClick={close} />
        </div>
        <div className="steps">
          {STEPS.map((s, i) => (
            <button key={s} type="button" className={`${i <= reached ? 'reached' : ''}${i === step ? ' cur' : ''}`} onClick={() => i <= reached && goStep(i)} aria-current={i === step ? 'step' : undefined} disabled={i > reached}>
              <span />
              <span className="nowrap">
                {i < step && stepOk[i] ? '✓ ' : `${i + 1}. `}
                {s}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="overlay-body">
        <div className="inner">
          {step === 0 && (
            <div className="card">
              <div className="row gap8">
                <button type="button" className="icon-btn plain" aria-label="เดือนก่อน" onClick={() => setMonth(addMonths(month, -1))} disabled={month <= startOfMonth(today) && !editing}>
                  <ChevronLeft {...IC} />
                </button>
                <span className="heading grow center" style={{ fontSize: 18 }}>
                  {fmtMonth(month.slice(0, 7))}
                </span>
                <button type="button" className="icon-btn plain" aria-label="เดือนถัดไป" onClick={() => setMonth(addMonths(month, 1))}>
                  <ChevronRight {...IC} />
                </button>
              </div>
              <div className="mini-cal">
                {TH_DAYS_SHORT.map((d) => (
                  <div key={d} className="cal-dow">
                    {d}
                  </div>
                ))}
                {cells.map((d) => {
                  if (d < first || d > last) return <span key={d} />;
                  const past = d < today && !editing;
                  const free = dayFree(d, ctx, excl);
                  const isEnd = d === checkIn || d === checkOut;
                  const mid = checkIn && checkOut && d > checkIn && d < checkOut;
                  return (
                    <button key={d} type="button" disabled={past} className={`${isEnd ? 'end' : mid ? 'mid' : ''}${d === today ? ' today' : ''}`} onClick={() => pickDay(d)} aria-label={`${fmtDate(d)} ว่าง ${free} ที่`} aria-pressed={isEnd}>
                      <span className="d">{Number(d.slice(8))}</span>
                      <span className="s" style={!isEnd && free === 0 ? { color: 'var(--danger-text)' } : !isEnd && free <= 6 ? { color: 'var(--color-accent-strong)' } : undefined}>
                        {free === 0 ? 'เต็ม' : free}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="b" style={{ fontSize: 15 }}>
                {!checkIn ? 'แตะวันเข้าพัก' : !checkOut ? `เข้าพัก ${fmtDate(checkIn)} — แตะวันที่ออก` : `${fmtRange(checkIn, checkOut)} · ${nights.length} คืน · ช่วงนี้ว่างอย่างน้อย ${houseFree}/${cap} ที่`}
              </div>
              <div className="small muted">
                ตัวเลขใต้วันที่ = ที่ว่าง (จาก {cap}) · เช็คอิน {st.checkInTime} · เช็คเอาท์ {st.checkOutTime}
              </div>
            </div>
          )}

          {step === 1 && (
            <>
              <div className="card tight">
                <Stepper label="ผู้ใหญ่" value={adults} min={children > 0 ? 0 : 1} max={cap} onChange={(v) => { setAdults(v); setManual(null); }} />
                <div className="divider" />
                <Stepper label="เด็ก" desc="คิดราคาเท่าผู้ใหญ่" value={children} min={0} max={cap} onChange={(v) => { setChildren(v); setManual(null); }} />
              </div>
              <div className="row between" style={{ alignItems: 'baseline' }}>
                <h2 className="card-title">เลือกห้อง</h2>
                <span className="small muted">{st.bookingMode === 'room' ? 'จองเป็นห้อง' : 'ต่างกลุ่มพักห้องเดียวกันได้'}</span>
              </div>
              <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px, 100%), 1fr))', gap: 8 }}>
                {rooms.map((r) => {
                  const free = freeByRoom.get(r.id) ?? 0;
                  const sel = selRooms.includes(r.id);
                  const a = alloc.find((x) => x.roomId === r.id);
                  const canWhole = roomEmptyAllNights(nights, r, ctx, excl);
                  return (
                    <div key={r.id} className="col gap6">
                      <button type="button" className={`room-card${sel ? ' sel' : ''}`} disabled={!sel && free <= 0} onClick={() => toggleRoom(r.id)} aria-pressed={sel}>
                        <span style={{ color: sel ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>{sel ? <CircleCheck size={24} strokeWidth={1.75} /> : <Circle size={24} strokeWidth={1.75} />}</span>
                        <span className="grow" style={{ lineHeight: 1.4 }}>
                          <span className="b" style={{ display: 'block' }}>
                            {r.name} <span className="small muted" style={{ fontWeight: 400 }}>{ROOM_KIND_LABEL[r.kind]}</span>
                          </span>
                          <span className="small" style={{ display: 'block', color: free <= 0 ? 'var(--danger-text)' : 'var(--color-text-muted)' }}>
                            {free <= 0 ? 'ไม่ว่าง' : `ว่าง ${free}/${r.capacity} ที่`}
                          </span>
                          {sel && a && (
                            <span className="small b" style={{ display: 'block', color: 'var(--color-primary)' }}>
                              จัดให้ {a.guests} คน{a.whole ? ' · ทั้งห้อง' : ''}
                            </span>
                          )}
                        </span>
                      </button>
                      {sel && st.bookingMode === 'both' && (
                        <label className="row small" style={{ gap: 8, paddingLeft: 6, cursor: canWhole ? 'pointer' : 'not-allowed', opacity: canWhole ? 1 : 0.5 }}>
                          <input type="checkbox" checked={whole.has(r.id)} disabled={!canWhole} onChange={(e) => setWhole((w) => { const n = new Set(w); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} style={{ width: 20, height: 20 }} />
                          จองทั้งห้อง (ไม่รับกลุ่มอื่น)
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              {selRooms.length > 1 && (
                <div className="card tight">
                  <div className="small b">ปรับจำนวนคนในแต่ละห้อง</div>
                  {alloc.map((a) => (
                    <Stepper
                      key={a.roomId}
                      label={ds.rooms.find((r) => r.id === a.roomId)?.name ?? ''}
                      value={a.guests}
                      min={0}
                      max={guests}
                      onChange={(v) => {
                        const base = Object.fromEntries(alloc.map((x) => [x.roomId, x.guests]));
                        base[a.roomId] = v;
                        // ปรับห้องอื่นให้รวมเท่าจำนวนแขก
                        let diff = Object.values(base).reduce((s, n) => s + n, 0) - guests;
                        for (const other of alloc) {
                          if (other.roomId === a.roomId || diff === 0) continue;
                          const n = Math.max(0, base[other.roomId]! - diff);
                          diff -= base[other.roomId]! - n;
                          base[other.roomId] = n;
                        }
                        setManual(base);
                      }}
                    />
                  ))}
                </div>
              )}
              {errors.length > 0 && (
                <div className="alert" role="alert">
                  <TriangleExclamationPoint {...IC} />
                  <span>{errors[0]}</span>
                </div>
              )}
              {!selRooms.length && guests > houseFree && (
                <div className="alert" role="alert">
                  <TriangleExclamationPoint {...IC} />
                  <span>{houseFree <= 0 ? `ช่วงนี้เต็มแล้ว (สูงสุด ${cap} คน) เลือกวันอื่น` : `ช่วงนี้รับได้อีก ${houseFree} คน (สูงสุด ${cap} คน) ลดจำนวนคนหรือเลือกวันอื่น`}</span>
                </div>
              )}
              <div className="card">
                <Toggle on={usesTransport} onChange={setUsesTransport} icon={<Car {...IC} />} title="ใช้รถรับส่ง" desc="ไป–กลับ · รวมในราคาแล้ว" />
                {usesTransport && (
                  <>
                    <input className="input" value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} placeholder="จุดรับ เช่น ขนส่งอาเขต, สนามบินเชียงใหม่" aria-label="จุดรับ" />
                    <div className="chips">
                      {st.transportTimes.map((t) => (
                        <button key={t} type="button" className="chip num" aria-pressed={pickupTime === t} onClick={() => setPickupTime(t)}>
                          {t}
                        </button>
                      ))}
                      <input className="input num" type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} aria-label="เวลารับอื่น" style={{ width: 130, height: 44 }} />
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ position: 'relative' }}>
                <label className="search">
                  <Search {...IC} />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาลูกค้าเก่า (ชื่อหรือเบอร์โทร)" aria-label="ค้นหาลูกค้าเก่า" />
                </label>
                {suggestions.length > 0 && (
                  <div className="card" style={{ marginTop: 6, padding: 0, gap: 0, overflow: 'hidden' }}>
                    {suggestions.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="list-row"
                        style={{ padding: '10px 14px' }}
                        onClick={() => {
                          setCustomerId(c.id);
                          setName(c.name);
                          setPhone(c.phone);
                          setLineId(c.lineId);
                          if (c.allergies) setAllergies(c.allergies);
                          const lastB = ds.bookings.filter((b) => b.customerId === c.id).sort((a, b) => b.checkIn.localeCompare(a.checkIn))[0];
                          if (lastB && lastB.channel !== 'online') setChannel(lastB.channel);
                          setSearch('');
                        }}
                      >
                        <span className="grow" style={{ lineHeight: 1.4 }}>
                          <span className="b" style={{ display: 'block' }}>
                            {c.name}
                          </span>
                          <span className="small muted">
                            {c.phone || '–'} · เข้าพัก {c.visits} ครั้ง
                          </span>
                        </span>
                        {(c.isRegular || c.visits >= 2) && <span className="tag-regular">ลูกค้าประจำ</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customerId && (
                <div className="alert info" style={{ alignItems: 'center' }}>
                  <Check {...IC} />
                  <span className="grow">ใช้ข้อมูลลูกค้าเดิม — แก้ไขได้ด้านล่าง</span>
                  <button type="button" className="btn btn-text btn-sm" onClick={() => setCustomerId(null)}>
                    ลูกค้าใหม่
                  </button>
                </div>
              )}
              <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 12 }}>
                <Field label="ชื่อลูกค้า / ชื่อกลุ่ม *">
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น คุณมิ้นท์ และเพื่อน" autoComplete="off" />
                </Field>
                <Field label="เบอร์โทรศัพท์ *">
                  <input className="input num" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="08x-xxx-xxxx" autoComplete="off" />
                </Field>
                <Field label="LINE ID">
                  <input className="input" value={lineId} onChange={(e) => setLineId(e.target.value)} autoCapitalize="none" autoComplete="off" />
                </Field>
                <Field label="อาหารที่แพ้ / ความต้องการพิเศษ">
                  <input className="input" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="เช่น แพ้กุ้ง 1 คน" />
                </Field>
                <div className="field" style={{ gridColumn: '1 / -1' }}>
                  ช่องทางที่จองมา
                  <Chips value={channel} onChange={setChannel} options={[...STAFF_CHANNELS, ...(channel === 'online' ? (['online'] as Channel[]) : [])].map((c) => ({ v: c, label: CHANNEL_LABEL[c] }))} />
                </div>
                <Field label="หมายเหตุ" full>
                  <textarea className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </div>
              {phone && phone.replace(/\D/g, '').length < 9 && <div className="small danger">ใส่เบอร์โทรให้ครบอย่างน้อย 9 หลัก</div>}
            </>
          )}

          {step === 3 && (
            <div className="card">
              <div className="row between" style={{ fontSize: 15 }}>
                <span className="muted">{calc}</span>
                <span className="b num">{fmtBaht(nightly.reduce((s, n) => s + n.price * guests, 0))}</span>
              </div>
              {!uniform && nightly.length > 0 && (
                <div className="small muted">
                  {nightly.map((n) => `${fmtDate(n.date, { year: false })} ${fmtBaht(n.price)}`).join(' · ')} (ต่อคน)
                </div>
              )}
              {showAdj ? (
                <div className="col gap8">
                  <div className="row">
                    <span className="grow b small">ส่วนลด</span>
                    <MoneyInput value={discount || null} onChange={(v) => setDiscount(v ?? 0)} ariaLabel="ส่วนลด (บาท)" width={140} />
                  </div>
                  <div className="row">
                    <span className="grow b small">รายการเพิ่ม</span>
                    <MoneyInput value={extra || null} onChange={(v) => setExtra(v ?? 0)} ariaLabel="รายการเพิ่ม (บาท)" width={140} />
                  </div>
                  {(extra > 0 || discount > 0) && <input className="input" value={extraNote} onChange={(e) => setExtraNote(e.target.value)} placeholder="รายละเอียด เช่น หมูกระทะเพิ่ม, ส่วนลดลูกค้าประจำ" aria-label="รายละเอียดส่วนลด/รายการเพิ่ม" />}
                </div>
              ) : (
                <button type="button" className="btn btn-text btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowAdj(true)}>
                  + ส่วนลด / รายการเพิ่ม
                </button>
              )}
              <div className="row between divider" style={{ paddingTop: 10 }}>
                <span className="b">ยอดรวม</span>
                <span className="b num" style={{ fontSize: 20 }}>
                  {fmtBaht(total)}
                </span>
              </div>
              <div className="field">
                ยอดมัดจำ
                <div className="row wrap" style={{ gap: 8 }}>
                  <Chips value={depMode} onChange={setDepMode} options={[{ v: 'percent', label: 'เป็น %' }, { v: 'amount', label: 'เป็นจำนวนเงิน' }]} />
                  {depMode === 'percent' ? (
                    <input
                      className="input money"
                      inputMode="decimal"
                      aria-label="มัดจำกี่เปอร์เซ็นต์"
                      value={depPctInput}
                      style={{ width: 96 }}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                        setDepPctInput(Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0);
                      }}
                    />
                  ) : (
                    <MoneyInput value={deposit} onChange={(v) => setDepAmtInput(v ?? 0)} ariaLabel="ยอดมัดจำ (บาท)" width={140} />
                  )}
                  <span className="grow right b num" style={{ fontSize: 17 }}>
                    {fmtBaht(deposit)}
                  </span>
                </div>
                <span className="small muted" style={{ fontWeight: 400 }}>
                  ค่าตั้งต้น: {depositRuleText(st, fmtBaht)} (เปลี่ยนได้ที่ ตั้งค่า › ราคาและต้นทุน)
                </span>
              </div>
              {!editing ? (
                <>
                  <div className="small b">สถานะการชำระเงิน</div>
                  <div className="chips">
                    {(['unpaid', 'deposit', 'paid'] as PayStatus[]).map((p) => (
                      <button key={p} type="button" className="chip" aria-pressed={payStatus === p} onClick={() => setPayStatus(p)} style={payStatus === p ? { background: PILL[p].bg, color: PILL[p].fg } : undefined}>
                        {p === 'unpaid' ? <Circle {...IC16} /> : p === 'deposit' ? <HalfCircle /> : <Check {...IC16} />}
                        {p === 'unpaid' ? 'ยังไม่ชำระ' : p === 'deposit' ? `มัดจำ ${fmtBaht(deposit)}` : 'ชำระเต็มจำนวน'}
                      </button>
                    ))}
                  </div>
                  {payStatus !== 'unpaid' && (
                    <>
                      <div className="small b">ช่องทางรับชำระ</div>
                      <Chips value={method} onChange={setMethod} options={(['transfer', 'promptpay', 'cash'] as PayMethod[]).map((m) => ({ v: m, label: METHOD_LABEL[m] }))} />
                      {method !== 'cash' && (
                        <>
                          <input
                            ref={fileRef}
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              e.target.value = '';
                              if (f) setSlip(await addImage(f));
                            }}
                          />
                          <button type="button" className="dashed" onClick={() => (slip ? setSlip(null) : fileRef.current?.click())}>
                            {slip ? (
                              <span className="row ok" style={{ gap: 8 }}>
                                <CircleCheck {...IC} />
                                แนบสลิปแล้ว · แตะเพื่อเอาออก
                              </span>
                            ) : (
                              <span className="row" style={{ gap: 8 }}>
                                <Camera {...IC} />
                                แนบสลิปโอนเงิน
                              </span>
                            )}
                          </button>
                        </>
                      )}
                    </>
                  )}
                  <div className="col gap6 divider" style={{ paddingTop: 10, fontSize: 15 }}>
                    <div className="row between">
                      <span className="muted">รับวันนี้</span>
                      <span className="b num ok">{fmtBaht(paidNow)}</span>
                    </div>
                    <div className="row between">
                      <span className="muted">คงเหลือ (ชำระวันเข้าพัก)</span>
                      <span className="b num">{fmtBaht(total - paidNow)}</span>
                    </div>
                    <div className="small muted">
                      มัดจำ {fmtBaht(deposit)} ภายใน {st.depositDueDays} วัน ({fmtDate(depositDueOn)}) · ยกเลิกไม่คืนมัดจำ · เลื่อนวันได้ {st.rescheduleLimit} ครั้ง
                    </div>
                  </div>
                </>
              ) : (
                <div className="small muted">รับเงินเพิ่ม/คืนเงิน ทำได้ที่หน้ารายละเอียดการจอง · ราคาเดิม ณ วันจองยังคงใช้ถ้าไม่เปลี่ยนวันที่หรือจำนวนคน</div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="overlay-foot">
        <div className="inner">
          <div className="grow" style={{ lineHeight: 1.35 }}>
            <div className="b num" style={{ fontSize: 22 }}>
              {fmtBaht(total)}
            </div>
            <div className="small muted ellipsis">{summary || 'เลือกวันที่เข้าพัก'}</div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => (step === 0 ? close() : goStep(step - 1))}>
            {step === 0 ? 'ยกเลิก' : 'ย้อนกลับ'}
          </button>
          {step < 3 ? (
            <button type="button" className="btn btn-primary" disabled={!canNext} onClick={() => goStep(step + 1)}>
              ถัดไป
            </button>
          ) : (
            <button type="button" className="btn btn-accent" disabled={saving || !stepOk[0] || !stepOk[1] || !stepOk[2]} onClick={() => void onSave()}>
              {editing ? 'บันทึก' : 'บันทึกการจอง'}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
