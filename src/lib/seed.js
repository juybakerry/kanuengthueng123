// Demo data generated on first run (deterministic — seeded RNG), relative to TODAY.
import { TODAY, SET0, CHANNELS, DEVICES, add, pd, fD, fDY, gOf, calcTotal } from './core.js';

export function seedData() {
  const S = JSON.parse(JSON.stringify(SET0));
  let s = 11;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const P = [
    ['คุณสมศรี ใจดี', '081-234-5678', 'somsri.j'], ['คุณวิชัย รุ่งเรือง', '089-112-3344', 'wichai_r'],
    ['กลุ่มครูโรงเรียนบ้านนา', '086-555-0192', 'kru.banna'], ['คุณนภา แสงทอง', '092-448-7710', 'napa.st'],
    ['คุณอนันต์ พูลสุข', '083-901-2288', 'anan.p'], ['ครอบครัวศรีสวัสดิ์', '081-776-4402', 'srisawat.fam'],
    ['คุณปิยะพร มณีวงศ์', '095-330-1187', 'piyaporn.m'], ['ชมรมจักรยานเขาใหญ่', '087-620-4455', 'bike.ky'],
    ['คุณธนากร ศักดิ์ดี', '084-219-6630', 'thanakorn.s'], ['คุณมาลี ทองคำ', '090-515-7788', 'malee.t'],
    ['คุณกิตติ วงศ์ไทย', '082-367-9901', 'kitti.w'], ['กลุ่มเพื่อน ม.เกษตร', '061-448-2210', 'ku.friends'],
    ['คุณสุดารัตน์ บุญมา', '093-802-5566', 'sudarat.b'], ['คุณเอกชัย ศรีงาม', '085-114-3390', 'ekachai.s'],
    ['ครอบครัวแก้วมณี', '088-240-6617', 'kaewmanee'], ['คุณพิมพ์ชนก ดวงดี', '097-613-2045', 'pimchanok.d'],
  ];
  const PL = ['สถานีขนส่งห้วยกุ๊บกั๊บ', 'ตลาดห้วยกุ๊บกั๊บ', 'สถานีรถไฟ', 'ปั๊ม ปตท. ปากทาง'];
  const TM = ['10:00', '11:30', '13:00', '13:30', '14:00', '15:30'];
  const AL = ['แพ้อาหารทะเล 1 ท่าน', 'ไม่ทานเนื้อวัว', 'ทานมังสวิรัติ 2 ท่าน', 'แพ้ถั่ว 1 ท่าน'];
  const occ = {}, bookings = [];
  let n = 1;

  const place = (ci, nights, g) => {
    const ns = [];
    for (let i = 0; i < nights; i++) ns.push(add(ci, i));
    const order = g > 4 ? ['r5', 'r1', 'r2', 'r3', 'r4'] : ['r1', 'r2', 'r3', 'r4', 'r5'].sort(() => rnd() - 0.5);
    const rooms = {};
    let left = g;
    for (const r of order) {
      const cap = r === 'r5' ? 8 : 4;
      const free = Math.min(...ns.map(d => cap - ((occ[d] || {})[r] || 0)));
      const t = Math.min(free, left);
      if (t > 0) { rooms[r] = t; left -= t; }
      if (!left) break;
    }
    if (left) return null;
    ns.forEach(d => { occ[d] = occ[d] || {}; for (const r in rooms) occ[d][r] = (occ[d][r] || 0) + rooms[r]; });
    return rooms;
  };

  const mk = (ci, nights, g, o = {}) => {
    const rooms = place(ci, nights, g);
    if (!rooms) return;
    const p = o.p || P[Math.floor(rnd() * P.length)];
    const co = add(ci, nights);
    const kids = o.kids != null ? o.kids : (rnd() < 0.3 ? 1 + Math.floor(rnd() * 2) : 0);
    const children = Math.min(kids, g - 1);
    let status = o.status;
    if (!status) {
      if (co <= TODAY) status = rnd() < 0.96 ? 'paid' : 'deposit';
      else if (ci <= TODAY) status = 'paid';
      else { const r = rnd(); status = r < 0.3 ? 'unpaid' : r < 0.8 ? 'deposit' : 'paid'; }
    }
    let created = o.created || add(ci, -(4 + Math.floor(rnd() * 25)));
    if (!o.created && created > add(TODAY, -3)) created = add(TODAY, -3 - Math.floor(rnd() * 10));
    if (!o.status && status === 'unpaid' && add(created, S.depositDays) < TODAY) status = 'deposit';
    const transfer = o.transfer != null ? o.transfer : rnd() < 0.55;
    const t = calcTotal(ci, co, g, S);
    bookings.push({
      id: 'KT-' + String(n++).padStart(4, '0'), name: p[0], phone: p[1], line: p[2], checkIn: ci, checkOut: co,
      adults: g - children, children, rooms, transfer,
      pickupPlace: transfer ? (o.place || PL[Math.floor(rnd() * 4)]) : '',
      pickupTime: transfer ? (o.time || TM[Math.floor(rnd() * 6)]) : '',
      total: t.total, status, slips: status !== 'unpaid' ? ['slip-' + n + '.jpg'] : [],
      channel: o.ch || CHANNELS[Math.floor(rnd() * 4)],
      allergy: o.allergy != null ? o.allergy : (rnd() < 0.15 ? AL[Math.floor(rnd() * 4)] : ''),
      note: o.note || '', createdAt: created, rescheduled: false, cancelled: false, surveySent: co < add(TODAY, -3),
    });
  };

  const fixed = {
    [add(TODAY, -2)]: [() => mk(add(TODAY, -2), 2, 6, { p: P[3], status: 'paid', transfer: false })],
    [TODAY]: [
      () => mk(TODAY, 2, 10, { p: P[2], transfer: true, place: 'สถานีขนส่งห้วยกุ๊บกั๊บ', time: '13:30', status: 'deposit', allergy: 'แพ้กุ้ง 1 ท่าน', ch: 'Facebook', created: add(TODAY, -6), kids: 0 }),
      () => mk(TODAY, 1, 4, { p: P[5], transfer: true, place: 'ตลาดห้วยกุ๊บกั๊บ', time: '15:00', status: 'paid', ch: 'LINE', kids: 2, allergy: '' }),
    ],
    [add(TODAY, 1)]: [() => mk(add(TODAY, 1), 1, 8, { p: P[7], status: 'unpaid', created: add(TODAY, -1), transfer: true, place: 'สถานีรถไฟ', time: '11:30', ch: 'LINE', kids: 0 })],
    [add(TODAY, 4)]: [() => mk(add(TODAY, 4), 2, 12, { p: P[11], status: 'unpaid', created: TODAY, ch: 'Facebook', kids: 0 })],
    [add(TODAY, 11)]: [() => mk(add(TODAY, 11), 1, 5, { p: P[0], status: 'unpaid', created: add(TODAY, -4), ch: 'โทร' })],
  };
  const start = add(TODAY, -120), end = add(TODAY, 63), farFrom = add(TODAY, 32);
  for (let d = start; d < end; d = add(d, 1)) {
    (fixed[d] || []).forEach(f => f());
    if (d >= add(TODAY, -2) && d <= add(TODAY, 1)) continue;
    const dow = pd(d).getUTCDay();
    const wk = dow === 5 || dow === 6;
    const far = d > farFrom;
    const p = (wk ? 0.85 : 0.28) * (far ? 0.5 : 1);
    if (rnd() < p) mk(d, rnd() < 0.7 ? 1 : 2, 2 + Math.floor(rnd() * 9));
    if (wk && rnd() < 0.5 * (far ? 0.4 : 1)) mk(d, 1, 2 + Math.floor(rnd() * 6));
  }

  const past = bookings.find(b => b.checkIn >= add(TODAY, -46) && b.checkOut < TODAY);
  const E = (id, days, title, detail, amount, category, dev, roomId, status, extra = {}) => ({
    id, date: add(TODAY, days), title, detail, amount, category, reporter: DEVICES[dev].label,
    bookingId: '', roomId, status, recovered: 0, photos: [], ...extra,
  });
  const expenses = [
    E('E-001', -83, 'หลอดไฟห้องที่ 3 ขาด', 'เปลี่ยนหลอด LED 2 ดวง', 180, 'อุปกรณ์ / ของใช้', 1, 'r3', 'done'),
    E('E-002', -70, 'ปั๊มน้ำเสีย', 'ช่างมาซ่อม เปลี่ยนสวิตช์แรงดัน', 1200, 'ซ่อมแซม', 0, '', 'done', { photos: ['receipt-pump.jpg'] }),
    E('E-003', -55, 'ซื้อผ้าเช็ดตัวเพิ่ม 12 ผืน', '', 960, 'อุปกรณ์ / ของใช้', 0, '', 'done'),
    E('E-004', -43, 'แก้วน้ำแตก 3 ใบ', 'ลูกค้ารับผิดชอบค่าเสียหาย', 150, 'อุปกรณ์ / ของใช้', 1, '', 'done', { bookingId: past ? past.id : '', recovered: 150 }),
    E('E-005', -26, 'ก๊อกน้ำห้องที่ 2 รั่ว', 'เปลี่ยนก๊อกและสายน้ำดี', 450, 'ซ่อมแซม', 1, 'r2', 'done'),
    E('E-006', -15, 'ล้างแอร์ทั้ง 5 ห้อง', '', 2500, 'ทำความสะอาด', 0, '', 'done', { photos: ['receipt-air.jpg'] }),
    E('E-007', -7, 'ลูกค้าเจอมดในห้อง', 'ให้ส่วนลดชดเชย', 300, 'ชดเชยลูกค้า', 0, 'r4', 'done'),
    E('E-008', -1, 'มุ้งลวดห้องที่ 5 ขาด', 'รอช่างมาเปลี่ยน', 350, 'ซ่อมแซม', 1, 'r5', 'doing', { photos: ['mung.jpg'] }),
    E('E-009', 0, 'น้ำอุ่นห้องที่ 4 ไม่ร้อน', '', 0, 'ซ่อมแซม', 1, 'r4', 'todo'),
  ];

  const last = bookings.find(b => b.createdAt === TODAY);
  const y = fDY(add(TODAY, -1)), t = fDY(TODAY);
  const audit = [
    { t: `${t} 09:12`, device: DEVICES[0].label, action: 'สร้างการจอง', detail: last ? `${last.id} ${last.name} · ${fD(last.checkIn)} · ${gOf(last)} คน` : '' },
    { t: `${t} 08:40`, device: DEVICES[1].label, action: 'แจ้งปัญหา', detail: 'E-009 น้ำอุ่นห้องที่ 4 ไม่ร้อน' },
    { t: `${y} 19:05`, device: DEVICES[0].label, action: 'เปลี่ยนสถานะชำระเงิน', detail: 'คุณนภา แสงทอง: มัดจำ 50% → ชำระครบ' },
    { t: `${y} 16:22`, device: DEVICES[1].label, action: 'แจ้งปัญหา', detail: 'E-008 มุ้งลวดห้องที่ 5 ขาด · 350 บาท' },
    { t: `${y} 10:30`, device: DEVICES[0].label, action: 'สร้างการจอง', detail: `ชมรมจักรยานเขาใหญ่ · ${fD(add(TODAY, 1))} · 8 คน` },
  ];

  return {
    v: 1, bookings, expenses,
    closures: [{ id: 'c1', from: add(TODAY, 20), to: add(TODAY, 21), room: 'r3', reason: 'ทาสีห้องใหม่' }],
    audit, settings: S,
  };
}
