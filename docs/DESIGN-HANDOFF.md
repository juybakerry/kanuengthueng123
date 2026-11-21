# Handoff: Kanuengthueng Homestay Management App (คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์)

## Overview
An internal booking and operations app for a 5‑room, 24‑guest homestay in Huai Kub Kab, Mae Taeng, Chiang Mai. Two devices (owner on a phone, staff on a tablet) share the same live data. The app covers today's tasks, the availability calendar, bookings and payments, problem/expense logging, a profit dashboard, customers and settings. There is also a phase‑2 public booking page for guests.

The requirements source is `Kanuengthueng_Requirement_Form_v1.1.docx` (in this folder). Sections 2–9 are the functional requirements, sections 11–13 are brand, UI/UX and tokens. This README records the decisions taken from that form plus everything the prototype shows.

## About the design files
The files in `prototype/` are **design references built in HTML**. They show the intended look and behaviour; they are not production code. Rebuild them in a real stack.

No codebase exists yet. Recommended stack, chosen to fit form §5 and §12.5:
- **PWA**, mobile‑first, responsive to tablet and desktop (installable, full‑screen, no App Store).
- React + TypeScript (Next.js or Vite), CSS variables from `tokens.css`.
- Cloud database with realtime sync and offline queue (e.g. Supabase or Firebase). Both devices must see the same data in real time (§5.2), and the app must keep working on unstable mobile data (§5.3, §12.5).
- Thai locale everywhere: Buddhist‑era dates (`21 พ.ย. 2569`), baht as `฿1,234`.

To view the prototypes: open `prototype/Kanuengthueng App.dc.html` in a browser (keep `support.js` and `assets/` beside it). The device (mobile 390 px / tablet 1024 px) and theme are props; the in‑app moon/sun button and Settings also switch the theme.

## Fidelity
**High fidelity.** Colours, type, spacing, radii, copy and interactions are final for v1 and should be matched closely. Sample bookings, customers, problems and the Jun–Oct history in the dashboard are fake demo data.

---

## Confirmed business rules (from the form)
| Topic | Rule |
|---|---|
| Rooms | ห้อง 1–4 ห้องเล็ก 4 คน each, ห้อง 5 ห้องใหญ่ 8 คน. Total 24. No extra beds; max 24. |
| Booking unit | Both: whole room or per person/bed. Different groups may share a room (§2.2). |
| Check‑in / out | 14:00 / 11:00 |
| Price | ฿850 per person per night. Includes lodging + 1 meal. Children same price as adults. Holiday pricing: optional, phase 1 feature #7. |
| Payment status | ยังไม่ชำระ / มัดจำ 50% / ชำระเต็มจำนวน. Plus stay status: upcoming → กำลังพัก (checked in) → checked out. |
| Payment methods | โอนธนาคาร, พร้อมเพย์, เงินสด |
| Deposit | 50% within 3 days of booking. Remainder at check‑in. |
| Cancellation | Deposit not refunded. Date can be moved once. |
| Food cost | ฿60 per head per day (night) |
| Housekeeper | ฿300 per day, only days with guests, regardless of guest count |
| Transport | ฿200 per head per booking (round trip). Not charged to guest; it is a cost to the business. |
| Costs editable | Yes, in Settings |
| Fixed monthly costs | Electricity, water, internet, other — amounts not yet provided (fields left empty). Include in profit once entered. |
| Revenue period | Counted by stay night (วันที่เข้าพัก) |
| Problem expenses | Deducted by payment date. Money recovered from a guest is recorded as extra income. |
| Permissions | Everyone sees everything (2 users: เจ้าของ, พนักงาน) |
| Export | Excel and PDF |
| Phase 1 features (§9) | 1–11 all phase 1 (overbooking guard, LINE notifications, PromptPay QR + slip, PDF confirmation/receipt, daily task sheet, returning‑customer DB, special pricing, audit log, daily auto backup, online booking page, satisfaction survey). #12 import old data: not needed. Note: #10 online booking page is marked phase 1 in the form but the form's own note recommends phase 2; confirm with the client. |

### Calculations
```
people        = adults + kids
total         = price × people × nights
deposit       = total × 0.5
revenue(range)= Σ over nights in range: price × people staying that night
food(range)   = Σ nights in range: foodCost × people
maid(range)   = maidCost × count(distinct nights in range with ≥1 guest)
transport     = transportCost × people   (bookings that use the shuttle, counted on check‑in date)
problems      = Σ problem.amount where problem.date in range
recovered     = Σ problem.recovered where problem.date in range
profit        = revenue + recovered − food − maid − transport − problems − fixedCosts
occupancy %   = personNights / (24 × days in range)
roomFree(d,r) = closed(d,r) ? 0 : cap(r) − Σ alloc[r] of bookings covering night d
dayFree(d)    = Σ roomFree(d, r)
```
Form §4 sample (verified by the prototype logic): 10 people 1 night → revenue 8,500, costs 2,900, profit 5,600; 24p/1n → 20,400 / 6,540 / 13,860; 10p/2n → 17,000 / 3,800 / 13,200.

---

## Data model (suggested)
```ts
Room      { id: 1..5, name: 'ห้อง 1', type: 'ห้องเล็ก'|'ห้องใหญ่', capacity: 4|8 }
Closure   { id, roomId, from: ISODate, to: ISODate /*inclusive nights*/, reason }
Booking   { id, customerId, name, phone, lineId, channel: 'Facebook'|'LINE'|'โทร'|'Walk-in',
            checkIn: ISODate, nights, adults, kids,
            alloc: Record<roomId, people>,          // supports whole-room and shared rooms
            transport: { point, time } | null,
            payStatus: 'unpaid'|'deposit'|'paid', paidAmount, method, slipUrls[],
            stayStatus: 'upcoming'|'in'|'out',
            allergy, note, createdAt, rescheduledOnce: boolean }
Payment   { id, bookingId, amount, method, slipUrl, at, by }
Problem   { id, date, title, category, amount, status: 'wait'|'doing'|'done',
            roomId?, bookingId?, recovered, photoUrls[], reportedBy }
Customer  { id, name, phone, lineId, visits (derived), lastStay (derived) }
AuditLog  { id, entity, entityId, action, by: user+device, at }
Settings  { price, foodCost, maidCost, transportCost, fixed: { elec, water, net, other[] }, theme }
User      { id, role: 'owner'|'staff', device }
Survey    { bookingId, stars 1–5, tags[], comment, at }
```
Problem categories: ซ่อมแซม · อุปกรณ์ / ของใช้ · ค่าน้ำ–ไฟ · ทำความสะอาด · ชดเชยลูกค้า · อื่นๆ

---

## App shell & layout
- **Mobile (390 × 844 reference):** status bar 44 px; page header (title Mitr 500 26 px, sync chip, theme button 44×44); scroll area with 16 px side padding and 140 px bottom padding; bottom nav 5 items; floating "+ จองใหม่" button.
- **Tablet (1024 × 768 reference):** left sidebar 248 px (logo mark 44 px + "คะนึงถึง" Mitr 22 / "ห้วยกุ๊บกั๊บ โฮมสเตย์" 14 muted; full‑width accent "+ จองใหม่" 48 px; 7 nav rows 48 px, active = primary bg / on‑primary text, radius 12; sync chip + user at bottom). Content padding 28 px 32 px. Grids use `repeat(auto-fit, minmax(300–320px, 1fr))`, so cards go 2‑up on tablet.
- **Bottom nav (mobile):** วันนี้ · ปฏิทิน · การจอง · สรุปผล · เพิ่มเติม. Icon 24 px inside a 56×32 pill (active pill bg `--color-surface-2`, active colour `--color-primary`, weight 600), label 14 px. Background `--nav-bg` with 12 px backdrop blur, 1 px top border `--color-surface-2`.
- **FAB:** bottom‑right (16 px, 104 px from bottom), height 56, pill, `--color-accent` bg, charcoal text, 600, `--shadow-fab`; hover `--color-accent-strong` + white text. Shown on วันนี้ / ปฏิทิน / การจอง (mobile). On tablet the sidebar button replaces it.
- **Sync chip:** pill 14 px. Online: Fog bg, cloud‑check icon, "บันทึกแล้ว". Offline: `#C98A12` bg, charcoal text, cloud‑off icon, "รอซิงก์ N".
- **Header decoration:** 3 thin contour lines (stroke 1.2, primary colour, opacity 0.08) top‑right of headers / sidebar.
- Cards: `--color-surface`, radius 16, `--shadow-soft`, padding 16. Status pills: radius 999, 13 px 600, 14 px icon + label, padding 1px 10px 1px 8px, colours from status tokens (always icon + text, never colour alone).
- Buttons: height 48 (44 minimum tap). Primary = primary bg / on‑primary. Accent = accent bg / charcoal. Secondary = 1.5 px primary border, transparent. Radius 12.
- Inputs: height 48, radius 12, no border, fill `--color-surface-2`, 16 px text, placeholder `--color-text-muted`.
- Segmented controls: track `--color-surface-2` radius 12 padding 4; segment height 40, radius 10; selected = surface bg + soft shadow + text colour; others muted.
- Chips (filters/options): height 40–44, pill. Selected = primary bg / on‑primary; unselected = surface (filters) or surface‑2 (options).
- Switches: 48×28 track, 24 px white knob, on = primary (offline switch uses deposit yellow), 150 ms.

## Screens
Numbering follows form §12.7. `data-screen-label` attributes in the prototype use the same numbers.

### 1. Splash / เข้าสู่ระบบ
Full‑bleed `mood-mist.jpg` with gradient `rgba(22,19,17,.15) → 0 at 35% → .78 at bottom`. Logo mark 112 px (radius 26, shadow) fades in with "mist" animation (opacity 0→1, translateY 8→0, blur 6→0, 900 ms, ease), then title "คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์" (Mitr 500 26 white) and tagline "โฮมสเตย์เล็ก ๆ สำหรับคนที่อยากหนีความวุ่นวายมาพักผ่อน" (Itim 20) fade in 300 ms later. Bottom: label "เข้าสู่ระบบในชื่อ", two 56 px buttons: "เจ้าของกิจการ" (Mist bg, charcoal) and "พนักงาน" (outlined, translucent). Footer Itim "กองไฟ บทเพลง มิตรภาพ". Real build: replace with proper auth (PIN or LINE Login per device).

### 2. วันนี้ (Home)
- Hero: `mood-mountain-deck.jpg`, gradient `rgba(31,35,32,.35) → transparent 32% → --hero-fade`. Top row: logo 36 + "คะนึงถึง" Mitr 20, sync chip and theme button on translucent dark glass. Greeting by time of day ("อรุณสวัสดิ์" morning) Mitr 500 30, date "วันเสาร์ที่ 21 พ.ย. 2569". Three glass stat tiles (radius 12, `rgba(22,19,17,.32)` + blur): คืนนี้ N คน · ที่ว่าง X/24 · เช็คอินวันนี้ N กลุ่ม. Mobile hero is full‑bleed; tablet hero has radius 16.
- **งานวันนี้** timeline sorted by time. Each row: time (600, tabular, muted, 48 px column) + card with 40 px icon tile, title 600, subtitle 14 muted, and either an action button ("เช็คเอาท์"/"เช็คอิน", secondary style) or a check toggle. Done rows drop to 55% opacity with strike‑through title. Tasks are derived from data:
  - 11:00 เช็คเอาท์ per booking ending today (show outstanding balance if any)
  - 11:30 ทำความสะอาด rooms vacated today ("ให้เสร็จก่อนแขกเข้า 14:00")
  - transport pickup per arriving booking with shuttle (time, point, people)
  - 14:00 เช็คอิน per arriving booking
  - 18:00 เตรียมอาหาร N ที่ (+ allergies)
- **ยอดค้างชำระ** card: total (28 px, `--color-accent-strong`), count, up to 4 rows (name, due rule, amount, status pill). Tap → booking detail.
- **ห้องคืนนี้**: 5 rows, room name + note (ว่าง / มีแขกคืนนี้ / ต้องทำความสะอาด in ember / ปิดห้อง), 8 px progress bar, used/cap.

### 3. ปฏิทิน
Segmented: รายเดือน · รายสัปดาห์ · ห้อง × วัน. Prev/next 44 px buttons; swipe left/right on the month grid changes month.
- **Month:** 7 columns, gap 4, cells radius 10 (64 px tall mobile, 92 px tablet). Today = `--color-highlight` bg; selected = 2 px primary border. Top‑right free seats: mobile number only (hidden when 24), tablet "เหลือ X/24"; ≤6 shown in ember, 0 = "เต็ม" in unpaid red. Up to 3 (mobile) / 4 (tablet, with guest name) booking bars coloured by status. Lock icon when any room is closed. Legend below. Selected‑day card: title, "เข้าพัก N คน · เหลือ X/24 ที่", 5 mini room bars (closed = hatch), booking rows with pills, "+ จองวันนี้" button (opens new booking with that date).
- **Week:** 7 cards (day, date, booking chips coloured by status, "เหลือ X/24").
- **Timeline:** rooms × 14 days grid, 44 px cells, horizontal scroll. Occupied cells filled with status colour and "used/cap"; today outlined in accent; closed cells hatched with lock. Tap → booking.

### 4. จองใหม่ (4 steps)
Full‑screen sheet. Header "จองใหม่" + close. Step bar 4 segments (4 px bars, primary when reached) labelled 1. วันที่ · 2. ห้อง / คน · 3. ลูกค้า · 4. ชำระเงิน; completed steps show ✓ and are tappable. Sticky footer: total (600 22 px), summary line ("10 คน · 2 คืน · ห้อง 1, ห้อง 2"), "ยกเลิก/ย้อนกลับ" secondary, "ถัดไป" primary (disabled = Fog bg, muted text); last step button "บันทึกการจอง" in accent.
1. **วันที่:** month grid, each day shows free seats; past days disabled (35% opacity). First tap = check‑in, second later tap = check‑out; range highlighted (ends primary, between Fog). Helper text shows range and nights.
2. **ห้อง / คน:** steppers for ผู้ใหญ่ (min 1) and เด็ก ("คิดราคาเท่าผู้ใหญ่"). Room cards (check circle, name, type, "ว่าง X/cap ที่" as min free across the nights, "จัดให้ N คน"). Guests are auto‑allocated to selected rooms in selection order. Full/closed rooms disabled. **Overbooking guard** (red alert, shown immediately): if people > day free across range → "ช่วงนี้รับได้อีก X คน (สูงสุด 24 คน) ลดจำนวนคนหรือเลือกวันอื่น"; if selected rooms too small → "ห้อง 5 รับได้อีก 2 คน ลองเลือกห้องอื่นเพิ่ม" (single room) / "ห้องที่เลือกรับได้อีก X คน ลองเลือกห้องอื่นเพิ่ม". Shuttle switch reveals pickup point input + time chips (10:00 12:00 13:00 15:00).
3. **ลูกค้า:** search old customers by name or phone → suggestion list (with "ลูกค้าประจำ" badge) → tap autofills name/phone/LINE/channel. Fields: ชื่อลูกค้า / ชื่อกลุ่ม *, เบอร์โทรศัพท์ *, LINE ID, อาหารที่แพ้ / ความต้องการพิเศษ, ช่องทางที่จองมา chips, หมายเหตุ.
4. **ชำระเงิน:** calc line, status chips (selected uses status colours), method chips, slip attach (dashed 56 px; hidden for unpaid or cash), "รับวันนี้" / "คงเหลือ (ชำระวันเข้าพัก)", policy line with deposit due date.
On save: create booking + audit entry, toast "บันทึกการจองแล้ว", open the booking detail.

### 5. รายละเอียดการจอง
Top bar: back, "การจอง B101", "ยกเลิกการจอง" (red, trash icon). Large status pill (40 px, 17 px) + payment pill when checked in. Name Mitr 28, date range 17 600, nights line. Quick actions 4 × 68 px tiles: โทร · LINE · ส่ง QR · ใบยืนยัน. Payment card: ยอดรวม / ชำระแล้ว (`--ok-text`) / คงเหลือ (ember), progress bar, rule line, slip thumbnail, actions ("รับมัดจำ ฿X" + "รับเต็มจำนวน", or "รับส่วนที่เหลือ ฿X"). Info card: people, room chips, shuttle, phone, LINE, channel, allergy, note. ประวัติการแก้ไข (audit log: action, timestamp, user + device). Sticky bottom action by stay status: เช็คอิน → เช็คเอาท์ → ส่งแบบประเมินความพึงพอใจ.
- **QR sheet:** bottom sheet radius 24 top, PromptPay QR (placeholder in prototype; real build must generate EMVCo PromptPay payload with amount), label (ยอดมัดจำ 50% / ยอดคงเหลือ), amount 28 px, "ส่งให้ลูกค้าทาง LINE".
- **Cancel:** confirm dialog "ยกเลิกการจองนี้?" with policy reminder; on confirm, toast with "เลิกทำ" for 5 s.

### 6. แจ้งปัญหา / ค่าใช้จ่าย
Primary summary card (month total, recovered, open count) with accent "แจ้งปัญหา" button. Status filter chips. Problem cards: title, amount, "date · category · room · แจ้งโดย", status pill (tap cycles รอแก้ไข → กำลังแก้ → เสร็จแล้ว; colours unpaid/deposit/paid), recovered amount in `--ok-text`. **Form:** camera/receipt capture tile (140 px dashed), title *, amount *, category chips, room chips, status chips, "เรียกเก็บคืนจากลูกค้า" switch + amount, full‑width save.

### 7. สรุปผล (Dashboard)
Period segmented: วันนี้ · เดือนนี้ · ปีนี้ · เลือกช่วงวัน (+ range caption with comparison basis). 4 KPI cards: รายรับรวม, กำไรสุทธิ, ยอดค้างชำระ (+ booking count), อัตราการเข้าพัก. Value 26 px 600 tabular; delta row with trend icon (green up / red down, % or "จุด" for occupancy) and a 64×24 sparkline (last 6 months, stroke `--color-secondary` 1.75). Bar chart card 160 px: daily revenue by stay night (month/custom; today's bar in accent), monthly revenue (year), people per room (day); bars primary, radius 4 top, labels every 5th day. Cost breakdown: stacked 12 px bar + legend (อาหาร primary, แม่บ้าน secondary, รถรับส่ง info, แจ้งปัญหา tertiary) and recovered note. Facts: ลูกค้าที่เข้าพัก, ห้องที่ถูกจองบ่อยที่สุด, ช่องทางที่จองมาเยอะที่สุด, รายรับคิดตาม วันที่เข้าพัก. Export buttons Excel / PDF.

### 8. ลูกค้า
Search (name/phone), "ลูกค้าทั้งหมด N ราย · ลูกค้าประจำ N ราย". Cards: initial avatar 44 px, name, "ลูกค้าประจำ" badge (Dawn Gold bg, charcoal) when ≥2 stays, "เข้าพัก N ครั้ง · ล่าสุด date". Tap expands: phone/LINE, stay history rows with pills (tap → booking), "จองให้ลูกค้าคนนี้" (prefills new booking).

### 9. ตั้งค่า
Theme segmented หมอกเช้า / กองไฟ / อัตโนมัติ ("อัตโนมัติ: หมอกเช้า 06:00–18:00 · กองไฟหลัง 18:00"; also respect OS preference). Price & cost inputs (right‑aligned numeric). Fixed monthly costs (empty = "ยังไม่ระบุ"). Rooms list with closure pill (ปิดห้อง/ปิดวัน must be creatable — §6.5). Users (2 devices). Data & sync: daily backup status, offline simulation switch (prototype only), link to the public booking page, logout.

### 10. ใบยืนยันการจอง / ใบเสร็จ PDF
Opened from "ใบยืนยัน" in booking detail. Tabs ใบยืนยันการจอง / ใบเสร็จ (receipt disabled until something is paid). A4‑style white sheet, always black on white so it prints in greyscale: full logo greyscale top‑left, doc title Mitr 22 + number (BK‑2569‑101 / RC‑2569‑101) + issue date; business name, address, Facebook/IG; guest and stay grid; line items (ค่าที่พัก (รวมอาหาร 1 มื้อ) price × people × nights; รถรับส่ง ไป–กลับ "รวมแล้ว"); total, paid (method), balance, status outline pill; PromptPay QR block with amount and due rule (confirmation only); special requests; policy line; sign‑off in Itim "ขอบคุณที่มาพักผ่อน ไว้มาพบกันใหม่เน้อ". Actions: บันทึก PDF, ส่งทาง LINE (logs to audit).

### 11. หน้าจองออนไลน์ลูกค้า (phase 2) — `Customer Booking Page.dc.html`
Public, fluid web page. Hero 88vh on `mood-mist.jpg` with nav (logo, เรื่องของเรา, บรรยากาศ, accent "ดูวันว่าง"), Itim "กองไฟ บทเพลง มิตรภาพ", title (Mitr clamp 34–60), tagline, 3 glass facts. Story section (copy + mountain photo, check‑in/out and room cards). Dark gallery (6 mood images with captions). Booking section: availability calendar (free seats; ≤6 Dawn Gold "เหลือน้อย"; full red), request form (nights/people steppers, name, phone, LINE, note), live price, overbooking warning, accent submit → thank‑you state "ได้รับคำขอแล้วเน้อ". Requests land in the app as unpaid pending bookings for the owner to confirm. Footer forest green.

### 12. ขอบคุณ / แบบประเมิน
Guest‑facing page (prototype shows it as a preview from a checked‑out booking). Full‑bleed `mood-campfire.jpg` fading to Night. Logo, Itim 30 "ขอบคุณที่มาพักผ่อน / ไว้มาพบกันใหม่เน้อ", "ใช้เวลาไม่ถึง 30 วินาที". 5 stars (52 px targets, filled `#E8893A`) with label (ต้องปรับปรุง … ประทับใจที่สุด), tag chips (ที่พักสะอาด, อาหารอร่อย, บรรยากาศดี, กองไฟ & ดนตรี, การบริการ, การเดินทาง), optional comment, "ส่งคะแนน" (enabled after a star). Sent state: flame icon "ได้รับคะแนนแล้ว ขอบคุณมากเน้อ". Staff action: "ส่งลิงก์นี้ให้ลูกค้าทาง LINE".

---

## Interactions & behaviour
- Motion 150–250 ms, `cubic-bezier(.2,.8,.2,1)`. Sheets/overlays slide up 24 px + fade (220 ms). Mist fade only on splash/thank‑you. No distracting animation.
- Toast: charcoal bar above bottom nav, check icon, auto‑hide 2.6 s; with undo 5 s.
- Every save shows feedback; destructive actions ask for confirmation and offer undo.
- **Offline:** write to local store first, queue, sync when back online; chip shows "รอซิงก์ N"; on reconnect toast "สัญญาณกลับมาแล้ว · ซิงก์ N รายการเรียบร้อย".
- Loading: skeleton blocks (not spinners). Empty states: mountain line drawing + helpful text + action.
- Core tasks within 3 taps: new booking (FAB), take payment (booking → รับ…), see today's free rooms (home).
- Audit log every change to bookings and money (who, device, when).
- LINE notifications (phase 1): new booking, guests arriving tomorrow, deposit due soon.
- Error copy always says how to fix it (see overbooking messages).
- UX writing: staff screens in clear central Thai; guest‑facing screens (documents, thank‑you, booking page) add a light northern touch ("เน้อ").

## State (prototype → real app)
Prototype holds everything in one component state: `bookings[]`, `problems[]`, `prices`, `fixed`, `theme`, `user`, UI state (`tab`, `calView`, `calYM`, `selDay`, `bfilter`, `bsearch`, `period`, `detail`, `form` + `step`, `pform`, `qr`, `doc`, `survey`, `confirm`, `toast`, `offline`, `pending`, `done{}` for task checkmarks). In production, persist domain data in the cloud DB with realtime subscriptions; keep UI state local. Derived values (free seats, tasks, KPIs, customers) should be computed, not stored.

## Design tokens
See `tokens.css` (form §13.1 plus a few extras marked "+"). Summary:
- Palette ratio ≈ 60% Mist/Fog, 30% Forest/Charcoal, 10% Campfire.
- Type: Mitr 500 for headings (22–32 px; page titles 26, section 18–20); IBM Plex Sans Thai 400 body 16 / secondary 14 / numbers 600 tabular‑nums; Itim only for splash, thank‑you and document sign‑off. Line height 1.6 for Thai. Minimum text 14 px (calendar micro‑labels 12 px are the only exception; review).
- Spacing 4 8 12 16 24 32 48. Radius: cards 16, buttons/inputs 12, small 8, pills 999.
- Icons: Lucide, stroke 1.75, sizes 16/20/24.
- Charts colour order: Forest → Moss → Dawn Teal → Guitar Wood. Flat bars, no 3D.
- Contrast WCAG AA ≥ 4.5:1; tap targets ≥ 44×44.

## Assets (`prototype/assets/`)
- `logo-full.jpg` — original word‑cloud logo 1468×1756 (from the form). Use on documents (greyscale) and splash/booking hero.
- `logo-mark.png` — short mark (dark blob on Mist rounded square, 512 px). Used for header, sidebar, favicon, app icon in the prototype.
- `mood-mountain-deck.jpg` (Today hero), `mood-mist.jpg` (splash, booking page hero), `mood-peak-sky.jpg`, `mood-campfire.jpg` (campfire mode card, thank‑you), `mood-folk-night.jpg`, `mood-village.jpg` — low‑res samples from the Facebook page. **Request high‑res originals from the client** (form §13.2).
- Still needed: transparent PNG/SVG logo (or vectorise, §11.5); app icons 1024/512/192 light + dark; favicons 16/32/48; contour / guitar‑string SVG patterns.
- Fonts: Google Fonts (OFL) — Mitr, IBM Plex Sans Thai, Itim.

## Files
- `prototype/Kanuengthueng App.dc.html` — screens 1–10 and 12 (+ bookings list and More menu). Props: `device` = mobile | tablet, `theme` = mist | campfire | auto.
- `prototype/Customer Booking Page.dc.html` — screen 11.
- `prototype/support.js` — runtime needed to open the prototypes locally. Not part of the product.
- `tokens.css` — design tokens.
- `Kanuengthueng_Requirement_Form_v1.1.docx` — original requirements.

## Open items to confirm with the client
1. Owner name and contact details (form §1 blank), budget and go‑live date (§10.1–10.2).
2. Fixed monthly cost amounts (§4.6).
3. Holiday/festival price rules (§3.4, feature #7).
4. Whether the online booking page ships in phase 1 or 2 (#10).
5. Real room names (§2 "ชื่อห้องที่ใช้จริง").
6. Logo source files and high‑res photos (§11.5, §13.2).
7. Design approval (§12.9).

## UI acceptance checklist (form §13.4)
- [ ] All text meets WCAG AA (≥ 4.5:1) in both themes
- [ ] New booking, take payment, today's free rooms each within 3 taps
- [ ] Correct on phone, tablet and desktop
- [ ] Campfire (dark) mode works on every screen
- [ ] Logo and icons sharp at all sizes, never distorted
- [ ] Thai text renders fully, no bad line breaks
- [ ] Keeps working when mobile data drops temporarily
