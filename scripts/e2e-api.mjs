// ทดสอบ API ทั้งวงจรกับเซิร์ฟเวอร์ local (wrangler dev พอร์ต 8797):
//   node scripts/e2e-api.mjs [http://127.0.0.1:8797] [ADMIN_TOKEN]
// สร้างผู้ใช้ทดสอบ → จอง → กันจองเกิน (รวมสองเครื่องพร้อมกัน) → ชนกัน → รับเงิน → หน้าลูกค้า → แบบประเมิน
const B = process.argv[2] ?? 'http://127.0.0.1:8797';
const ADMIN = process.argv[3] ?? 'dev-admin-token';
let pass = 0;
let fail = 0;
const ok = (cond, msg) => {
  if (cond) pass++;
  else fail++;
  console.log(`${cond ? '✔' : '✘'} ${msg}`);
};

async function req(path, { method, body, cookie } = {}) {
  const r = await fetch(B + path, { method: method ?? (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await r.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: r.status, data, setCookie: r.headers.get('set-cookie') };
}

const uid = () => crypto.randomUUID();
const day = (n) => {
  const d = new Date(Date.now() + 7 * 3600e3);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const uname = `t${Date.now().toString(36)}`;
const mk = await fetch(`${B}/api/admin/users`, { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: uname, displayName: 'ทดสอบ', password: 'testpass123', role: 'owner' }) });
ok(mk.ok, 'สร้างผู้ใช้ทดสอบด้วย ADMIN_TOKEN');
const bad = await req('/api/login', { body: { username: uname, password: 'wrong-pass' } });
ok(bad.status === 401, 'รหัสผ่านผิดถูกปฏิเสธ');
const lg = await req('/api/login', { body: { username: uname, password: 'testpass123', device: 'เครื่องทดสอบ A' } });
ok(lg.status === 200 && lg.setCookie?.includes('HttpOnly'), 'เข้าสู่ระบบได้ cookie HttpOnly');
const A = lg.setCookie.split(';')[0];
const lg2 = await req('/api/login', { body: { username: uname, password: 'testpass123', device: 'เครื่องทดสอบ B' } });
const Bc = lg2.setCookie.split(';')[0];

const anon = await req('/api/sync?since=0');
ok(anon.status === 401, 'ไม่เข้าสู่ระบบ อ่านข้อมูลไม่ได้');

const s0 = await req('/api/sync?since=0', { cookie: A });
ok(s0.status === 200 && s0.data.records.some((r) => r.tbl === 'rooms'), 'ซิงก์ครั้งแรกได้ห้องพัก');
const rooms = s0.data.records.filter((r) => r.tbl === 'rooms' && !r.deletedAt);
ok(rooms.reduce((s, r) => s + r.data.capacity, 0) === 24, 'ความจุรวม 24 คน');

// วันที่ห่างไกลเพื่อไม่ชนกับข้อมูลเดิม
const off = 200 + Math.floor(Math.random() * 300);
const ci = day(off);
const co = day(off + 2);
const booking = (id, guests, roomAlloc, extra = {}) => ({
  name: 'กลุ่มทดสอบ', phone: '0812345678', lineId: '', customerId: null, checkIn: ci, checkOut: co, adults: guests, children: 0, channel: 'phone', status: 'confirmed',
  rooms: roomAlloc, nightly: [{ date: ci, price: 85000 }, { date: day(off + 1), price: 85000 }], discount: 0, extra: 0, extraNote: '', total: 85000 * guests * 2,
  depositPct: 50, depositDueOn: day(3), usesTransport: true, pickupPoint: 'ขนส่งอาเขต', pickupTime: '12:00', mealCost: 6000, transportCost: 20000,
  allergies: '', notes: '', rescheduleCount: 0, cancelledOn: null, checkedInAt: null, checkedOutAt: null, surveyToken: '', createdBy: '', createdAt: '', code: '', ...extra,
});

const b1 = uid();
const m1 = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'bookings', id: b1, base: null, data: booking(b1, 6, [{ roomId: 'room-5', guests: 6, whole: false }]) }] } });
const r1 = m1.data.results[0];
ok(r1.status === 'ok' && /^KT-\d{4}-\d{4}$/.test(r1.record.data.code), `สร้างการจองได้ เลขที่ ${r1.record?.data.code}`);
ok(r1.record.data.surveyToken.length >= 12, 'มีลิงก์ลูกค้า (token)');

const opDup = uid();
const dupBody = { ops: [{ opId: opDup, tbl: 'customers', id: uid(), base: null, data: { name: 'ลูกค้าซ้ำ', phone: '0899999999' } }] };
await req('/api/mutate', { cookie: A, body: dupBody });
const dup = await req('/api/mutate', { cookie: A, body: dupBody });
ok(dup.data.results[0].status === 'dup', 'กดบันทึกซ้ำ (opId เดิม) ไม่บันทึกซ้ำ');

const b2 = uid();
const m2 = await req('/api/mutate', { cookie: Bc, body: { ops: [{ opId: uid(), tbl: 'bookings', id: b2, base: null, data: booking(b2, 4, [{ roomId: 'room-5', guests: 4, whole: false }]) }] } });
ok(m2.data.results[0].status === 'rejected' && m2.data.results[0].error.includes('ห้อง 5 รับได้อีก 2 คน'), `จองเกินห้องถูกปฏิเสธ: ${m2.data.results[0].error}`);

// สองเครื่องจองที่ว่างสุดท้ายพร้อมกัน — ต้องผ่านแค่เครื่องเดียว
const x1 = uid();
const x2 = uid();
const [ra, rb] = await Promise.all([
  req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'bookings', id: x1, base: null, data: booking(x1, 2, [{ roomId: 'room-5', guests: 2, whole: false }]) }] } }),
  req('/api/mutate', { cookie: Bc, body: { ops: [{ opId: uid(), tbl: 'bookings', id: x2, base: null, data: booking(x2, 2, [{ roomId: 'room-5', guests: 2, whole: false }]) }] } }),
]);
const statuses = [ra.data.results[0].status, rb.data.results[0].status].sort();
ok(statuses[0] === 'ok' && statuses[1] === 'rejected', `สองเครื่องจองพร้อมกัน ผ่านเครื่องเดียว (${statuses.join(', ')})`);

const w1 = uid();
const mw = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'bookings', id: w1, base: null, data: booking(w1, 2, [{ roomId: 'room-1', guests: 2, whole: true }]) }] } });
ok(mw.data.results[0].status === 'ok', 'จองทั้งห้องได้');
const w2 = uid();
const mw2 = await req('/api/mutate', { cookie: Bc, body: { ops: [{ opId: uid(), tbl: 'bookings', id: w2, base: null, data: booking(w2, 1, [{ roomId: 'room-1', guests: 1, whole: false }]) }] } });
ok(mw2.data.results[0].status === 'rejected', 'ห้องที่จองทั้งห้องแล้ว กลุ่มอื่นจองไม่ได้');

// ชนกัน: A แก้จากฐานเก่า หลัง B แก้ไปแล้ว
const base1 = r1.record.updatedAt;
const e1 = await req('/api/mutate', { cookie: Bc, body: { ops: [{ opId: uid(), tbl: 'bookings', id: b1, base: base1, data: { ...r1.record.data, notes: 'แก้จาก B' }, summary: 'แก้หมายเหตุ' } ] } });
ok(e1.data.results[0].status === 'ok', 'เครื่อง B แก้ไขได้');
const e2 = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'bookings', id: b1, base: base1, data: { ...r1.record.data, notes: 'แก้จาก A' } }] } });
ok(e2.data.results[0].status === 'conflict' && e2.data.results[0].record.data.notes === 'แก้จาก B', 'เครื่อง A ได้รับแจ้งข้อมูลชนกัน');
const e3 = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'bookings', id: b1, base: e2.data.results[0].record.updatedAt, force: true, data: { ...r1.record.data, notes: 'แก้จาก A' } }] } });
ok(e3.data.results[0].status === 'ok' && e3.data.results[0].record.data.code === r1.record.data.code, 'เลือกใช้ข้อมูลของฉันได้ เลขที่การจองคงเดิม');

// รับเงิน + ประวัติ
const p1 = uid();
const mp = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'payments', id: p1, base: null, data: { bookingId: b1, kind: 'deposit', method: 'promptpay', amount: 510000, paidOn: day(0), slipId: null, note: '' } }] } });
ok(mp.data.results[0].status === 'ok' && mp.data.results[0].record.data.recordedBy === 'ทดสอบ', 'บันทึกมัดจำได้ พร้อมชื่อผู้รับ');
const badPay = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'payments', id: uid(), base: null, data: { bookingId: b1, kind: 'deposit', method: 'promptpay', amount: -5, paidOn: day(0) } }] } });
ok(badPay.data.results[0].status === 'rejected', 'ยอดเงินติดลบถูกปฏิเสธ');
const s1 = await req(`/api/sync?since=${s0.data.seq}`, { cookie: Bc });
const audits = s1.data.records.filter((r) => r.tbl === 'audit' && r.data.rowId === b1);
ok(audits.length >= 3 && audits.some((a) => a.data.summary.includes('มัดจำ') && a.data.device === 'เครื่องทดสอบ A'), `ประวัติการแก้ไขครบ (${audits.length} รายการ) บอกเครื่องที่ทำ`);

// ปิดห้องทับการจองไม่ได้ / ปิดวันว่างได้ แล้วจองวันปิดไม่ได้
const cl = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'closures', id: uid(), base: null, data: { roomId: 'room-5', start: ci, end: ci, reason: 'ซ่อม' } }] } });
ok(cl.data.results[0].status === 'rejected', 'ปิดห้องทับช่วงที่มีคนจองไม่ได้');
const cday = day(off + 10);
const cl2 = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'closures', id: uid(), base: null, data: { roomId: null, start: cday, end: cday, reason: 'หยุดประจำปี' } }] } });
ok(cl2.data.results[0].status === 'ok', 'ปิดวันได้');
const bc = uid();
const mbc = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'bookings', id: bc, base: null, data: { ...booking(bc, 2, [{ roomId: 'room-2', guests: 2, whole: false }]), checkIn: cday, checkOut: day(off + 11), nightly: [{ date: cday, price: 85000 }] } }] } });
ok(mbc.data.results[0].status === 'rejected' && mbc.data.results[0].error.includes('ปิดรับแขก'), 'จองวันที่ปิดไม่ได้');

// ยกเลิกแล้วคืนที่ว่าง
const cancel = await req('/api/mutate', { cookie: A, body: { ops: [{ opId: uid(), tbl: 'bookings', id: w1, base: mw.data.results[0].record.updatedAt, data: { ...mw.data.results[0].record.data, status: 'cancelled' } }] } });
ok(cancel.data.results[0].status === 'ok' && cancel.data.results[0].record.data.cancelledOn, 'ยกเลิกการจองได้ บันทึกวันที่ยกเลิก');
const w3 = uid();
const mw3 = await req('/api/mutate', { cookie: Bc, body: { ops: [{ opId: uid(), tbl: 'bookings', id: w3, base: null, data: booking(w3, 4, [{ roomId: 'room-1', guests: 4, whole: false }]) }] } });
ok(mw3.data.results[0].status === 'ok', 'หลังยกเลิก ห้องกลับมาว่าง');

// หน้าลูกค้า
const av = await req(`/api/public/availability?from=${ci}&days=3`);
ok(av.status === 200 && av.data.days[0].free === 24 - 8 - 4 && !JSON.stringify(av.data).includes('กลุ่มทดสอบ'), `หน้าจองเห็นแค่ที่ว่าง (${av.data.days?.[0]?.free}) ไม่เห็นชื่อลูกค้า`);
const rq = await req('/api/public/request', { body: { name: 'ลูกค้าออนไลน์', phone: '0811111111', checkIn: day(off + 20), checkOut: day(off + 21), adults: 3, children: 0, message: 'ขอห้องวิวดี' } });
ok(rq.status === 200, 'ส่งคำขอจองออนไลน์ได้');
const rqFull = await req('/api/public/request', { body: { name: 'กลุ่มใหญ่', phone: '0811111112', checkIn: ci, checkOut: co, adults: 20, children: 0 } });
ok(rqFull.status === 409, 'คำขอเกินที่ว่างถูกปฏิเสธ');
const tok = r1.record.data.surveyToken;
const pay = await req(`/api/public/booking/${tok}`);
ok(pay.status === 200 && pay.data.paid === 510000 && pay.data.due === 510000, 'หน้าชำระเงินของลูกค้าแสดงยอดถูกต้อง');
const sv0 = await req(`/api/public/survey/${tok}`, { body: { score: 0 } });
ok(sv0.status === 400, 'แบบประเมินต้องให้ดาว');
const sv = await req(`/api/public/survey/${tok}`, { body: { score: 5, tags: ['กองไฟ & ดนตรี'], comment: 'ประทับใจมาก' } });
ok(sv.status === 200, 'ส่งแบบประเมินได้');
const sv2 = await req(`/api/public/survey/${tok}`);
ok(sv2.data.done === true, 'ส่งแล้วไม่ให้ส่งซ้ำ');

const ex = await fetch(`${B}/api/export.json`, { headers: { cookie: A } });
ok(ex.ok && (await ex.json()).records.length > 10, 'ส่งออกข้อมูลทั้งหมดเป็น JSON ได้');
const bk = await fetch(`${B}/api/admin/backup`, { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}` } });
ok(bk.ok, 'สำรองข้อมูลได้');
const cron = await fetch(`${B}/api/admin/cron?at=${encodeURIComponent(new Date(Date.UTC(2026, 10, 21, 11, 5)).toISOString())}`, { method: 'POST', headers: { Authorization: `Bearer ${ADMIN}` } });
ok(cron.ok, 'งานตั้งเวลา 18:00 ทำงานได้');

console.log(`\n${pass} ผ่าน · ${fail} ไม่ผ่าน`);
process.exit(fail ? 1 : 0);
