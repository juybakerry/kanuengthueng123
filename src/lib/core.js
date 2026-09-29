// Constants, date helpers and pricing shared by the whole app.

const pad2 = n => String(n).padStart(2, '0');
const now = new Date();
export const TODAY = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
export const LS_KEY = 'kt-homestay-v2';
export const CAP = 24;

export const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
export const TH_MF = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
export const DOW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
export const DOWF = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

// Dates are ISO strings (YYYY-MM-DD) handled in UTC so day math never shifts.
export const pd = s => { const a = s.split('-').map(Number); return new Date(Date.UTC(a[0], a[1] - 1, a[2])); };
export const iso = d => d.toISOString().slice(0, 10);
export const add = (s, n) => { const d = pd(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const addM = (s, n) => { const d = pd(s.slice(0, 8) + '01'); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
export const diff = (a, b) => Math.round((pd(b) - pd(a)) / 864e5);
export const nightsOf = b => {
  const r = [];
  if (!b.checkIn || !b.checkOut) return r;
  for (let d = b.checkIn; d < b.checkOut && r.length < 60; d = add(d, 1)) r.push(d);
  return r;
};
export const gOf = b => (+b.adults || 0) + (+b.children || 0);
export const fD = s => { const d = pd(s); return d.getUTCDate() + ' ' + TH_M[d.getUTCMonth()]; };
export const fDY = s => { const d = pd(s); return d.getUTCDate() + ' ' + TH_M[d.getUTCMonth()] + ' ' + (d.getUTCFullYear() + 543); };
export const fMY = s => { const d = pd(s); return TH_MF[d.getUTCMonth()] + ' ' + (d.getUTCFullYear() + 543); };
export const baht = n => Math.round(n || 0).toLocaleString('th-TH');

export function nowText() {
  const d = new Date();
  return `${d.getDate()} ${TH_M[d.getMonth()]} ${d.getFullYear() + 543} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Payment status palette.
export const ST = {
  unpaid: { label: 'ยังไม่ชำระ', bg: 'var(--color-accent-600)', fg: '#fff', soft: 'var(--color-accent-100)', ink: 'var(--color-accent-800)' },
  deposit: { label: 'มัดจำ 50%', bg: 'oklch(0.86 0.15 90)', fg: '#201e1d', soft: 'oklch(0.95 0.07 95)', ink: 'oklch(0.40 0.09 75)' },
  paid: { label: 'ชำระครบ', bg: 'oklch(0.56 0.12 150)', fg: '#fff', soft: 'oklch(0.94 0.05 150)', ink: 'oklch(0.36 0.09 150)' },
};
export const CANCEL = { label: 'ยกเลิกแล้ว', bg: 'var(--color-neutral-400)', fg: '#201e1d', soft: 'var(--color-neutral-200)', ink: 'var(--color-neutral-800)' };
export const stOf = b => (b.cancelled ? CANCEL : ST[b.status]);
export const paidOf = b => (b.status === 'paid' ? b.total : b.status === 'deposit' ? Math.round(b.total / 2) : 0);

export const CHANNELS = ['Facebook', 'LINE', 'โทร', 'Walk-in', 'ออนไลน์'];
export const CATS = ['ซ่อมแซม', 'อุปกรณ์ / ของใช้', 'ค่าน้ำ–ไฟ', 'ทำความสะอาด', 'ชดเชยลูกค้า', 'อื่นๆ'];
export const EXST = {
  todo: { label: 'รอแก้ไข', soft: 'var(--color-accent-100)', ink: 'var(--color-accent-800)' },
  doing: { label: 'กำลังแก้', soft: 'oklch(0.95 0.07 95)', ink: 'oklch(0.40 0.09 75)' },
  done: { label: 'เสร็จแล้ว', soft: 'oklch(0.94 0.05 150)', ink: 'oklch(0.36 0.09 150)' },
};
export const DEVICES = [{ id: 'd1', label: 'เครื่อง 1 · เจ้าของ' }, { id: 'd2', label: 'เครื่อง 2 · ผู้ช่วย' }];

export const PAGES = {
  dashboard: 'ภาพรวมกิจการ', calendar: 'ปฏิทินการจอง', bookings: 'การจองทั้งหมด', today: 'งานประจำวัน',
  expenses: 'แจ้งปัญหา / ค่าใช้จ่าย', customers: 'ฐานข้อมูลลูกค้า', settings: 'ตั้งค่า', audit: 'ประวัติการแก้ไข',
};
export const NAVL = {
  dashboard: 'ภาพรวม', calendar: 'ปฏิทิน', bookings: 'การจอง', today: 'งานวันนี้',
  expenses: 'แจ้งปัญหา', customers: 'ลูกค้า', settings: 'ตั้งค่า', audit: 'ประวัติแก้ไข',
};

export const SET0 = {
  price: 850, food: 60, maid: 300, transfer: 200, depositDays: 3, checkInTime: '14:00', checkOutTime: '11:00',
  fixed: [{ id: 'f1', name: 'ค่าไฟฟ้า', amount: 2500 }, { id: 'f2', name: 'ค่าน้ำประปา', amount: 400 }, { id: 'f3', name: 'ค่าอินเทอร์เน็ต', amount: 599 }],
  special: [
    { id: 's1', name: 'วันหยุดยาวออกพรรษา', from: '2026-10-23', to: '2026-10-25', price: 990 },
    { id: 's2', name: 'ปีใหม่', from: '2026-12-29', to: '2027-01-02', price: 1100 },
  ],
  group: { min: 15, pct: 5 },
  line: { newBooking: true, tomorrow: true, due: true, requests: true },
  summaryTime: '18:00',
  promptpay: '',
  promptpayName: '',
  publicUrl: '',
  backupAuto: true,
  lastBackup: `${fDY(TODAY)} 03:00`,
  rooms: [
    { id: 'r1', name: 'ห้องที่ 1', type: 'ห้องเล็ก', cap: 4 },
    { id: 'r2', name: 'ห้องที่ 2', type: 'ห้องเล็ก', cap: 4 },
    { id: 'r3', name: 'ห้องที่ 3', type: 'ห้องเล็ก', cap: 4 },
    { id: 'r4', name: 'ห้องที่ 4', type: 'ห้องเล็ก', cap: 4 },
    { id: 'r5', name: 'ห้องที่ 5', type: 'ห้องใหญ่', cap: 8 },
  ],
};

// Fill in settings added after the data was first saved.
export function withDefaults(S) {
  const d = JSON.parse(JSON.stringify(SET0));
  const s = S || {};
  return { ...d, ...s, line: { ...d.line, ...(s.line || {}) }, group: { ...d.group, ...(s.group || {}) } };
}

// Guests per night (t) and per room, ignoring cancelled bookings and optionally one booking being edited.
export function occupancy(bookings, excl) {
  const m = {};
  for (const b of bookings) {
    if (b.cancelled || b.id === excl) continue;
    for (const n of nightsOf(b)) {
      const o = m[n] = m[n] || { t: 0 };
      for (const r in b.rooms) o[r] = (o[r] || 0) + b.rooms[r];
      o.t += gOf(b);
    }
  }
  return m;
}
export const closedOn = (closures, d, rid) => closures.some(c => d >= c.from && d <= c.to && (c.room === 'all' || c.room === rid));
export const spotsLeft = (S, closures, occ, d) =>
  S.rooms.reduce((a, r) => a + (closedOn(closures, d, r.id) ? 0 : Math.max(0, r.cap - ((occ[d] || {})[r.id] || 0))), 0);

export const rateFor = (d, S) => {
  const sp = S.special.find(x => x.from && x.to && d >= x.from && d <= x.to);
  return sp ? { rate: +sp.price || 0, name: sp.name } : { rate: +S.price || 0, name: '' };
};

// Price per person per night (children priced as adults), with seasonal rates and a group discount.
export function calcTotal(ci, co, g, S) {
  const L = {};
  let gross = 0, n = 0;
  for (let d = ci; d < co && n < 60; d = add(d, 1)) {
    n++;
    const r = rateFor(d, S);
    const k = r.rate + '|' + r.name;
    L[k] = L[k] || { rate: r.rate, name: r.name, nights: 0 };
    L[k].nights++;
    gross += r.rate * g;
  }
  const disc = g >= (+S.group.min || 999) && +S.group.pct > 0 ? Math.round(gross * S.group.pct / 100) : 0;
  return {
    n, gross, disc, total: gross - disc,
    lines: Object.values(L).map(l => ({
      label: `${baht(l.rate)} × ${g} คน × ${l.nights} คืน${l.name ? ' (' + l.name + ')' : ''}`,
      amt: baht(l.rate * g * l.nights),
    })),
  };
}

export function download(filename, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
