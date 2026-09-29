import { Component } from 'react';
import {
  TODAY, CAP, TH_M, TH_MF, DOW, DOWF, pd, add, addM, diff, nightsOf, gOf, fD, fDY, fMY, baht, nowText,
  ST, CANCEL, stOf, paidOf, CHANNELS, CATS, EXST, DEVICES, PAGES, NAVL, calcTotal, download,
  withDefaults, occupancy, closedOn, spotsLeft,
} from './lib/core.js';
import { seedData } from './lib/seed.js';
import { pickData, diffOps, applyOps, randomToken } from './lib/ops.js';
import { Sync } from './lib/sync.js';
import { api, getPin, setPin, uploadAll } from './lib/api.js';
import { publicBase, shareToLine, copyText } from './lib/share.js';
import PinGate from './components/PinGate.jsx';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Toast from './components/Toast.jsx';
import Dashboard from './views/Dashboard.jsx';
import Calendar from './views/Calendar.jsx';
import Bookings from './views/Bookings.jsx';
import Today from './views/Today.jsx';
import Expenses from './views/Expenses.jsx';
import Customers from './views/Customers.jsx';
import Settings from './views/Settings.jsx';
import Audit from './views/Audit.jsx';
import BookingForm from './modals/BookingForm.jsx';
import BookingDetail from './modals/BookingDetail.jsx';
import DocumentView from './modals/DocumentView.jsx';
import ExpenseForm from './modals/ExpenseForm.jsx';
import CustomerDetail from './modals/CustomerDetail.jsx';

const DEVICE_KEY = 'kt-device';
const EMPTY = { bookings: [], expenses: [], closures: [], audit: [], requests: [], reviews: [] };

// Shared data as it arrives from the server or the local cache, with fields newer code expects.
function normalizeData(d) {
  const o = { ...EMPTY };
  for (const k of Object.keys(EMPTY)) if (Array.isArray(d[k])) o[k] = d[k];
  o.settings = withDefaults(d.settings);
  return o;
}

const readDevice = () => { try { return localStorage.getItem(DEVICE_KEY) === 'd2' ? 'd2' : 'd1'; } catch { return 'd1'; } };

const lineResult = (r, ok) => (r.ok ? ok
  : r.reason === 'empty' ? 'ไม่มีอะไรต้องสรุป'
    : r.reason === 'not-configured' ? 'ยังไม่ได้ตั้งค่า LINE บนเซิร์ฟเวอร์'
      : r.reason === 'no-targets' ? 'ยังไม่มีแชทลงทะเบียนรับแจ้งเตือน (พิมพ์ "ลงทะเบียน" ในแชท LINE OA)'
        : 'ส่งไม่สำเร็จ: ' + (r.error || r.reason));

export default class App extends Component {
  constructor(p) {
    super(p);
    this.sync = new Sync({ onRemote: d => this.applyRemote(d), onStatus: st => this.setState({ net: st, checked: true }) });
    const cached = this.sync.cache ? normalizeData(this.sync.cache) : null;
    const base = cached || normalizeData(seedData());
    this._base = pickData(base);
    this.state = {
      ...base, loaded: !!cached, net: { online: false, pending: this.sync.queue.length, lastSync: null, needPin: false }, info: null,
      page: 'dashboard', device: readDevice(), narrow: typeof window !== 'undefined' && window.innerWidth < 900,
      calMode: 'month', calCursor: TODAY, selDay: TODAY,
      dashMode: 'month', dashCursor: TODAY, dashFrom: add(TODAY, -29), dashTo: TODAY, bkFilter: 'upcoming', bkQ: '', custQ: '',
      modal: null, bf: null, detailId: null, docType: 'confirm', showQR: false, confirmCancel: false, ef: null, custKey: null,
      notifOpen: false, toast: '', cleaned: {}, tw: 1, grown: true, clock: '',
      cf: { from: TODAY, to: TODAY, room: 'all', reason: '' },
    };
  }

  // ─── lifecycle ────────────────────────────────────────────────────────────
  componentDidMount() {
    this.onR = () => this.setState({ narrow: window.innerWidth < 900 });
    this.onR();
    window.addEventListener('resize', this.onR);
    this.onKey = e => { if (e.key === 'Escape' && this.state.modal) this.setState({ modal: this.state.modal === 'doc' ? 'detail' : null }); };
    window.addEventListener('keydown', this.onKey);
    const tick = () => {
      const d = new Date();
      // The app works off "today"; reload after midnight so every screen moves to the new day.
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (iso !== TODAY && !this.state.modal) { window.location.reload(); return; }
      this.setState({ clock: String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') });
    };
    tick();
    this.clk = setInterval(tick, 15000);
    this.motion();
    this.sync.start();
    this.loadInfo();
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onR);
    window.removeEventListener('keydown', this.onKey);
    this.sync.stop();
    clearInterval(this.clk);
    cancelAnimationFrame(this._raf);
    clearTimeout(this._gt);
    clearTimeout(this.tt);
    // Forget the running animations so a remount (e.g. StrictMode) restarts them.
    this._pg = undefined;
    this._tk = '';
  }

  componentDidUpdate(_, prev) {
    this.motion();
    if (prev.device !== this.state.device) { try { localStorage.setItem(DEVICE_KEY, this.state.device); } catch { /* storage blocked */ } }
    const now = pickData(this.state);
    const ops = diffOps(this._base, now);
    if (ops.length) {
      this._base = now;
      this.sync.push(ops);
      this.sync.saveCache(now);
    }
  }

  // Fresh data from the server; changes not yet sent are re-applied on top so nothing typed is lost.
  applyRemote(d) {
    const data = normalizeData(applyOps(normalizeData(d), this.sync.queue));
    this._base = pickData(data);
    this.sync.saveCache(this._base);
    this.setState({ ...data, loaded: true });
  }

  async loadInfo() {
    try { this.setState({ info: await api('/api/info') }); } catch { /* offline — shown in settings */ }
  }

  // Server actions that need to be online (reset, test LINE…).
  async serverCall(path, body, okMsg) {
    try {
      const r = await api(path, { method: 'POST', body: body || {} });
      if (okMsg) this.flash(okMsg);
      return r;
    } catch (e) {
      this.flash(e.status === 0 ? 'ต้องเชื่อมต่อเซิร์ฟเวอร์ก่อน' : e.message);
      return null;
    }
  }

  // Dashboard entrance: bars grow in and numbers count up whenever the range changes.
  motion() {
    const s = this.state;
    if (s.page !== this._pg) {
      this._pg = s.page;
      if (s.page === 'dashboard') {
        this.setState({ grown: false });
        clearTimeout(this._gt);
        this._gt = setTimeout(() => this.setState({ grown: true }), 60);
      }
    }
    const k = s.page === 'dashboard' ? [s.dashMode, s.dashCursor, s.dashFrom, s.dashTo].join('|') : '';
    if (k && k !== this._tk) {
      this._tk = k;
      cancelAnimationFrame(this._raf);
      const t0 = performance.now(), D = 900;
      const step = t => {
        const p = Math.min(1, (t - t0) / D);
        this.setState({ tw: 1 - Math.pow(1 - p, 4) });
        if (p < 1) this._raf = requestAnimationFrame(step);
      };
      this.setState({ tw: 0 });
      this._raf = requestAnimationFrame(step);
    }
    if (!k) this._tk = '';
  }

  // ─── helpers ──────────────────────────────────────────────────────────────
  dev() { return DEVICES.find(d => d.id === this.state.device).label; }
  log(action, detail) { this.setState(s => ({ audit: [{ t: nowText(), device: this.dev(), action, detail }, ...s.audit].slice(0, 500) })); }
  flash(t) {
    this.setState({ toast: '' });
    setTimeout(() => this.setState({ toast: t }), 20);
    clearTimeout(this.tt);
    this.tt = setTimeout(() => this.setState({ toast: '' }), 2600);
  }
  roomName(id) { const r = this.state.settings.rooms.find(x => x.id === id); return r ? r.name : id; }
  roomsText(b) {
    const ks = Object.keys(b.rooms);
    return ks.sort().map(r => this.roomName(r).replace('ห้องที่ ', 'ห้อง ') + (ks.length > 1 ? ` (${b.rooms[r]})` : '')).join(', ');
  }
  isClosed(d, rid) { return closedOn(this.state.closures, d, rid); }
  occMap(excl) { return occupancy(this.state.bookings, excl); }
  leftOn(d, occ) { return spotsLeft(this.state.settings, this.state.closures, occ, d); }
  bookingUrl(b, kind) { return `${publicBase(this.state.settings)}/${kind}/${b.token}`; }

  // Older bookings may not have a public link token yet; create one on first use.
  ensureToken(b) {
    if (b.token) return b;
    const nb = { ...b, token: randomToken() };
    this.updB(b.id, { token: nb.token });
    return nb;
  }

  async share(text, okMsg) {
    if (shareToLine(text)) this.flash(okMsg);
    else if (await copyText(text)) this.flash('คัดลอกข้อความแล้ว วางในแชท LINE ได้เลย');
  }

  metrics(from, to) {
    const s = this.state, S = s.settings;
    let rev = 0, food = 0, tr = 0, gn = 0, arr = 0, out = 0, groups = 0;
    const days = new Set(), rc = {}, cc = {};
    for (const b of s.bookings) {
      // Cancelled bookings keep the (non-refundable) deposit as income.
      if (b.cancelled) { if (b.checkIn >= from && b.checkIn <= to) rev += paidOf(b); continue; }
      const ns = nightsOf(b), g = gOf(b), per = b.total / Math.max(1, ns.length);
      let k = 0;
      for (const n of ns) if (n >= from && n <= to) { k++; days.add(n); }
      rev += per * k; food += S.food * g * k; gn += g * k;
      if (b.checkIn >= from && b.checkIn <= to) {
        if (b.transfer) tr += S.transfer * g;
        arr += g; groups++;
        cc[b.channel] = (cc[b.channel] || 0) + 1;
        for (const r in b.rooms) rc[r] = (rc[r] || 0) + 1;
        out += b.total - paidOf(b);
      }
    }
    const maid = S.maid * days.size;
    let fixed = 0;
    const fm = S.fixed.reduce((a, f) => a + (+f.amount || 0), 0);
    for (let d = from; d <= to; d = add(d, 1)) {
      const dt = pd(d);
      const dim = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
      fixed += fm / dim;
    }
    let exp = 0, rec = 0;
    for (const e of s.expenses) if (e.date >= from && e.date <= to) { exp += +e.amount || 0; rec += +e.recovered || 0; }
    const nd = diff(from, to) + 1;
    const cost = food + maid + tr + fixed + exp;
    const income = rev + rec;
    const top = o => Object.entries(o).sort((a, b) => b[1] - a[1])[0] || null;
    return { rev, rec, income, food, maid, tr, fixed, exp, cost, profit: income - cost, out, arr, groups, gn, occ: gn / (CAP * nd) * 100, topRoom: top(rc), topCh: top(cc), nd };
  }

  // ─── dashboard ────────────────────────────────────────────────────────────
  dashRange() {
    const s = this.state, c = s.dashCursor, m = s.dashMode;
    if (m === 'day') return { from: c, to: c, label: fDY(c), pf: add(c, -1), pt: add(c, -1), pl: 'วันก่อน' };
    if (m === 'month') {
      const f = c.slice(0, 8) + '01', t = add(addM(f, 1), -1), pf = addM(f, -1);
      return { from: f, to: t, label: fMY(f), pf, pt: add(f, -1), pl: 'เดือนก่อน' };
    }
    if (m === 'year') {
      const y = +c.slice(0, 4);
      return { from: y + '-01-01', to: y + '-12-31', label: 'ปี ' + (y + 543), pf: (y - 1) + '-01-01', pt: (y - 1) + '-12-31', pl: 'ปีก่อน' };
    }
    const f = s.dashFrom;
    let t = s.dashTo;
    if (t < f) t = f;
    const n = diff(f, t) + 1;
    return { from: f, to: t, label: '', pf: add(f, -n), pt: add(f, -1), pl: 'ช่วงก่อนหน้า' };
  }

  vDash() {
    const s = this.state, tw = s.tw ?? 1, gr = s.grown;
    const R = this.dashRange(), M = this.metrics(R.from, R.to), P = this.metrics(R.pf, R.pt);
    const dl = (a, b, inv) => {
      if (!b) return { t: 'ไม่มีข้อมูล' + R.pl, c: 'var(--color-neutral-700)' };
      const p = (a - b) / Math.abs(b) * 100;
      const good = inv ? p <= 0 : p >= 0;
      return { t: `${p >= 0 ? '+' : ''}${p.toFixed(0)}% จาก${R.pl}`, c: good ? 'oklch(0.40 0.1 150)' : 'var(--color-accent-700)' };
    };
    const k = (label, v, pv, inv, color) => { const d = dl(v, pv, inv); return { label, value: baht(v * tw), delta: d.t, deltaColor: d.c, color: color || 'inherit' }; };
    const kpis = [
      k('รายรับรวม (บาท)', M.income, P.income),
      k('ต้นทุน + ค่าใช้จ่าย (บาท)', M.cost, P.cost, true),
      k('กำไรสุทธิ (บาท)', M.profit, P.profit, false, M.profit < 0 ? 'var(--color-accent-700)' : 'inherit'),
      { label: 'ยอดค้างชำระ (บาท)', value: baht(M.out * tw), delta: 'ลูกค้าเข้าพักในช่วงนี้ที่ยังจ่ายไม่ครบ', deltaColor: 'var(--color-neutral-700)', color: M.out > 0 ? 'var(--color-accent-700)' : 'inherit' },
    ];
    const mx = Math.max(1, M.food, M.maid, M.tr, M.fixed, M.exp);
    const cr = (label, v, note) => ({ label, value: baht(v * tw), pct: gr ? v / mx * 100 : 0, note });
    const S = s.settings;
    const costRows = [
      cr('ค่าอาหาร', M.food, `${baht(S.food)} บาท × ${baht(M.gn)} หัว-วัน`),
      cr('ค่าแม่บ้าน', M.maid, `${baht(S.maid)} บาท × ${Math.round(M.maid / (S.maid || 1))} วันที่มีลูกค้า`),
      cr('ค่ารถรับส่ง', M.tr, 'ต่อหัว ต่อการจอง (ไป–กลับ)'),
      cr('ต้นทุนคงที่', M.fixed, S.fixed.map(f => f.name).join(' · ')),
      cr('ค่าใช้จ่ายจากการแจ้งปัญหา', M.exp, M.rec ? `เรียกเก็บคืนจากลูกค้า ${baht(M.rec)} บาท (นับเป็นรายรับ)` : ''),
    ];
    const dA = dl(M.arr, P.arr);
    const stayRows = [
      { label: 'ลูกค้าที่เข้าพัก', value: `${baht(M.arr * tw)} คน`, sub: `${M.groups} การจอง · ${dA.t}` },
      { label: 'อัตราการเข้าพัก', value: `${(M.occ * tw).toFixed(0)}%`, sub: `${baht(M.gn)} จาก ${baht(CAP * M.nd)} ที่-คืน` },
      { label: 'ห้องที่ถูกจองบ่อยที่สุด', value: M.topRoom ? this.roomName(M.topRoom[0]) : '–', sub: M.topRoom ? `${M.topRoom[1]} การจอง` : '' },
      { label: 'ช่องทางที่จองมามากที่สุด', value: M.topCh ? M.topCh[0] : '–', sub: M.topCh ? `${M.topCh[1]} การจอง` : '' },
    ];
    const m = s.dashMode;
    const buckets = [];
    let note;
    const monthly = m === 'year' || (m === 'custom' && diff(R.from, R.to) > 62);
    if (monthly) {
      let f = R.from.slice(0, 8) + '01';
      while (f <= R.to) {
        const t = add(addM(f, 1), -1);
        buckets.push({ f: f < R.from ? R.from : f, t: t > R.to ? R.to : t, label: TH_M[pd(f).getUTCMonth()] });
        f = addM(f, 1);
      }
      note = 'รายเดือน';
    } else {
      const f = m === 'day' ? add(R.from, -13) : R.from, t = R.to, n = diff(f, t) + 1;
      for (let d = f; d <= t; d = add(d, 1)) {
        const dn = pd(d).getUTCDate();
        buckets.push({ f: d, t: d, label: (n <= 16 || dn % 5 === 1) ? String(dn) : '' });
      }
      note = m === 'day' ? '14 วันล่าสุด' : 'รายวัน';
    }
    const vals = buckets.map(b => { const x = this.metrics(b.f, b.t); return { ...b, r: x.income, c: x.cost }; });
    const mxv = Math.max(1, ...vals.map(v => Math.max(v.r, v.c)));
    const bars = vals.map((v, i) => ({
      label: v.label, delay: gr ? i * 18 : 0,
      hr: gr ? Math.round(v.r / mxv * 160) : 0, hc: gr ? Math.round(v.c / mxv * 160) : 0,
      tip: `${v.f === v.t ? fD(v.f) : fD(v.f) + ' – ' + fD(v.t)} · รายรับ ${baht(v.r)} · ต้นทุน ${baht(v.c)}`,
    }));
    const step = d => {
      const c = s.dashCursor;
      const n = m === 'day' ? add(c, d) : m === 'month' ? addM(c, d) : (+c.slice(0, 4) + d) + c.slice(4);
      this.setState({ dashCursor: n });
    };
    const modes = [['day', 'รายวัน'], ['month', 'รายเดือน'], ['year', 'รายปี'], ['custom', 'เลือกช่วงวันเอง']]
      .map(([key, l]) => ({ key, label: l, on: m === key, pick: () => this.setState({ dashMode: key }) }));
    this._M = M; this._R = R;
    return {
      modes, isCustom: m === 'custom', label: R.label, prev: () => step(-1), next: () => step(1),
      from: s.dashFrom, to: s.dashTo,
      setFrom: e => this.setState({ dashFrom: e.target.value }), setTo: e => this.setState({ dashTo: e.target.value }),
      kpis: kpis.map((x, i) => ({ ...x, delay: i * 70 })), costRows, stayRows: stayRows.map((x, i) => ({ ...x, delay: 280 + i * 70 })),
      bars, chartNote: note, hero: this.vHero(tw),
    };
  }

  vHero(tw) {
    const s = this.state, S = s.settings, o = this.occ[TODAY] || {};
    const B = s.bookings.filter(b => !b.cancelled);
    const arr = B.filter(b => b.checkIn === TODAY);
    const pk = arr.filter(b => b.transfer).map(b => b.pickupTime).sort();
    const dep = B.filter(b => b.checkOut === TODAY);
    const hr = new Date().getHours();
    const greet = hr < 12 ? 'สวัสดีตอนเช้า' : hr < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
    let n = 0;
    const rooms = S.rooms.map(r => {
      const g = Math.min(r.cap, o[r.id] || 0), cl = this.isClosed(TODAY, r.id), full = g >= r.cap;
      return {
        id: r.id, name: r.name.replace('ห้องที่ ', 'ห้อง '), cols: r.cap / 2, text: cl ? 'ปิด' : full ? 'เต็ม' : `${g}/${r.cap}`,
        cells: [...Array(r.cap)].map((_, i) => {
          const c = cl ? 'var(--color-neutral-300)' : i < g ? (full ? 'var(--color-accent)' : 'var(--color-text)') : null;
          return { bg: c || 'transparent', bd: c || 'var(--color-neutral-400)', delay: 200 + (n++) * 32 };
        }),
      };
    });
    return {
      greet: greet + ' · ' + fDY(TODAY), booked: Math.round((o.t || 0) * tw),
      line: `เช็คอินวันนี้ ${arr.length} กลุ่ม · เช็คเอาท์ ${dep.length} กลุ่ม${pk.length ? ` · รถรับส่งรอบแรก ${pk[0]}` : ''} · ว่างอีก ${this.leftOn(TODAY, this.occ)} ที่`,
      rooms, goToday: () => { this.setState({ page: 'today' }); window.scrollTo(0, 0); },
    };
  }

  exportExcel() {
    const R = this._R || this.dashRange(), M = this._M || this.metrics(R.from, R.to), s = this.state;
    const rows = [
      ['สรุปผลกิจการ คะนึงถึงโฮมสเตย์', R.from + ' ถึง ' + R.to], [],
      ['รายรับรวม', Math.round(M.income)], ['ค่าอาหาร', Math.round(M.food)], ['ค่าแม่บ้าน', Math.round(M.maid)],
      ['ค่ารถรับส่ง', Math.round(M.tr)], ['ต้นทุนคงที่', Math.round(M.fixed)], ['ค่าใช้จ่ายจากการแจ้งปัญหา', Math.round(M.exp)],
      ['กำไรสุทธิ', Math.round(M.profit)], ['ยอดค้างชำระ', Math.round(M.out)], ['อัตราการเข้าพัก %', M.occ.toFixed(1)], [],
      ['รหัส', 'ลูกค้า', 'เบอร์', 'เข้าพัก', 'ออก', 'คน', 'ห้อง', 'ช่องทาง', 'ยอดรวม', 'ชำระแล้ว', 'สถานะ'],
    ];
    s.bookings.filter(b => b.checkIn >= R.from && b.checkIn <= R.to)
      .forEach(b => rows.push([b.id, b.name, b.phone, b.checkIn, b.checkOut, gOf(b), this.roomsText(b), b.channel, b.total, paidOf(b), stOf(b).label]));
    const csv = '﻿' + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    download(`kanuengthueng-${R.from}-${R.to}.csv`, csv, 'text/csv');
    this.flash('ดาวน์โหลดไฟล์ Excel (CSV) แล้ว');
  }

  // ─── calendar ─────────────────────────────────────────────────────────────
  vCal() {
    const s = this.state, S = s.settings, occ = this.occ, m = s.calMode, c = s.calCursor;
    const on = d => s.bookings.filter(b => !b.cancelled && b.checkIn <= d && b.checkOut > d);
    const chip = b => { const st = stOf(b); return { id: b.id, label: `${b.name.replace(/^คุณ/, '')} · ${gOf(b)}`, bg: st.bg, fg: st.fg, open: e => { e.stopPropagation(); this.openDetail(b.id); } }; };
    const res = {
      modes: [['month', 'รายเดือน'], ['week', 'รายสัปดาห์'], ['timeline', 'ตารางห้อง × วัน']].map(([key, l]) => ({ key, label: l, on: m === key, pick: () => this.setState({ calMode: key }) })),
      mode: m, dow: DOW,
      today: () => this.setState({ calCursor: TODAY, selDay: TODAY }),
      prev: () => this.setState({ calCursor: m === 'week' ? add(c, -7) : addM(c, -1) }),
      next: () => this.setState({ calCursor: m === 'week' ? add(c, 7) : addM(c, 1) }),
    };
    if (m === 'month') {
      const f = c.slice(0, 8) + '01', dw = pd(f).getUTCDay(), dim = diff(f, addM(f, 1)), wk = Math.ceil((dw + dim) / 7), st = add(f, -dw);
      const cells = [];
      for (let i = 0; i < wk * 7; i++) {
        const d = add(st, i), list = on(d), booked = (occ[d] || {}).t || 0, left = this.leftOn(d, occ);
        const all = this.isClosed(d, 'all') && S.rooms.every(r => this.isClosed(d, r.id));
        const inMonth = d.slice(0, 7) === c.slice(0, 7), td = d === TODAY;
        cells.push({
          d, num: pd(d).getUTCDate(), info: all ? 'ปิดทั้งวัน' : `${booked} คน · ว่าง ${left}`,
          infoInk: left === 0 ? 'var(--color-accent-700)' : 'var(--color-neutral-700)',
          chips: list.slice(0, 3).map(chip), more: list.length > 3 ? `+${list.length - 3} กลุ่ม` : '',
          fg: inMonth ? 'inherit' : 'var(--color-neutral-500)',
          bg: all ? 'var(--color-neutral-300)' : inMonth ? 'var(--color-bg)' : 'var(--color-neutral-100)',
          ring: d === s.selDay ? 'inset 0 0 0 2px var(--color-accent)' : 'none',
          numBg: td ? 'var(--color-accent)' : 'transparent', numFg: td ? '#fff' : 'inherit',
          pick: () => this.setState({ selDay: d }),
        });
      }
      res.cells = cells;
      res.title = fMY(f);
    }
    if (m === 'week') {
      const st = add(c, -pd(c).getUTCDay());
      res.week = [...Array(7)].map((_, i) => {
        const d = add(st, i), booked = (occ[d] || {}).t || 0, left = this.leftOn(d, occ), td = d === TODAY;
        return {
          d, label: `${DOW[i]} ${fD(d)}`, info: `${booked} คน · ว่าง ${left}/24`,
          headBg: td ? 'var(--color-accent)' : 'transparent', headFg: td ? '#fff' : 'inherit',
          ring: d === s.selDay ? 'inset 0 0 0 2px var(--color-accent)' : 'none', pick: () => this.setState({ selDay: d }),
          items: on(d).map(b => {
            const x = stOf(b);
            return {
              id: b.id, name: b.name,
              meta: `${gOf(b)} คน · ${this.roomsText(b)}${b.checkIn === d ? ' · เข้าพัก' : ''}${b.transfer && b.checkIn === d ? ' · รถ ' + b.pickupTime : ''}`,
              stLabel: x.label, bg: x.bg, soft: x.soft, ink: x.ink, open: () => this.openDetail(b.id),
            };
          }),
        };
      });
      res.title = `${fD(st)} – ${fDY(add(st, 6))}`;
    }
    if (m === 'timeline') {
      const f = c.slice(0, 8) + '01', dim = diff(f, addM(f, 1));
      const days = [...Array(dim)].map((_, i) => add(f, i));
      res.tlHead = days.map(d => {
        const w = pd(d).getUTCDay(), td = d === TODAY;
        return { d, n: pd(d).getUTCDate(), dw: DOW[w], bg: td ? 'var(--color-accent)' : (w === 0 || w === 6) ? 'var(--color-neutral-200)' : 'transparent', fg: td ? '#fff' : 'inherit' };
      });
      const rows = S.rooms.map(r => ({
        id: r.id, name: r.name, sub: `${r.type} · ${r.cap} คน`,
        cells: days.map(d => {
          if (this.isClosed(d, r.id)) return { d, text: '×', bg: 'var(--color-neutral-300)', fg: 'var(--color-neutral-700)', tip: 'ปิดห้อง', open: () => {} };
          const bs = on(d).filter(b => b.rooms[r.id]);
          const g = bs.reduce((a, b) => a + b.rooms[r.id], 0);
          if (!g) return { d, text: '', bg: 'transparent', fg: 'inherit', tip: `${r.name} ว่าง ${fD(d)}`, open: () => this.openNew(d) };
          const x = stOf(bs[0]);
          return { d, text: String(g), bg: x.bg, fg: x.fg, tip: bs.map(b => b.name + ' ' + b.rooms[r.id] + ' คน').join(', '), open: () => this.openDetail(bs[0].id) };
        }),
      }));
      rows.push({
        id: 'total', name: 'รวมทั้งหมด', sub: 'จองแล้ว / 24',
        cells: days.map(d => {
          const t = (occ[d] || {}).t || 0;
          return { d, text: t ? String(t) : '', bg: t >= CAP ? 'var(--color-accent-100)' : 'transparent', fg: 'inherit', tip: `${t}/24 คน`, open: () => this.setState({ selDay: d, calMode: 'month', calCursor: d }) };
        }),
      });
      res.tlRows = rows;
      res.title = fMY(f);
    }

    const d = s.selDay, list = on(d), booked = (occ[d] || {}).t || 0, left = this.leftOn(d, occ);
    const closedAll = s.closures.some(x => x.room === 'all' && d >= x.from && d <= x.to);
    const day = {
      dow: 'วัน' + DOWF[pd(d).getUTCDay()], title: fDY(d), booked, left, leftInk: left === 0 ? 'var(--color-accent-700)' : 'inherit',
      rooms: S.rooms.map(r => {
        const cl = this.isClosed(d, r.id), g = (occ[d] || {})[r.id] || 0;
        const who = list.filter(b => b.rooms[r.id]).map(b => `${b.name} (${b.rooms[r.id]})`).join(', ');
        return {
          id: r.id, name: r.name,
          text: cl ? 'ปิดห้อง' : g >= r.cap ? `เต็ม ${g}/${r.cap}` : g ? `${g}/${r.cap} คน · ว่าง ${r.cap - g}` : 'ว่างทั้งห้อง',
          ink: cl || g >= r.cap ? 'var(--color-accent-700)' : 'var(--color-neutral-700)', pct: cl ? 100 : g / r.cap * 100, who: who || '–',
        };
      }),
      list: list.map(b => {
        const x = stOf(b);
        return { id: b.id, name: b.name, meta: `${gOf(b)} คน · ${fD(b.checkIn)} – ${fD(b.checkOut)} · ${this.roomsText(b)}`, stLabel: x.label, soft: x.soft, ink: x.ink, open: () => this.openDetail(b.id) };
      }),
      book: () => this.openNew(d),
      closeLabel: closedAll ? 'ยกเลิกการปิดวันนี้' : 'ปิดวันนี้ (ไม่รับจอง)',
      toggleClose: () => {
        if (closedAll) {
          this.setState(st => ({ closures: st.closures.filter(x => !(x.room === 'all' && d >= x.from && d <= x.to)) }));
          this.log('ยกเลิกการปิดวัน', fDY(d));
        } else {
          this.setState(st => ({ closures: [...st.closures, { id: 'c' + Date.now(), from: d, to: d, room: 'all', reason: 'ปิดร้าน' }] }));
          this.log('ปิดวัน', fDY(d) + ' · ทั้งโฮมสเตย์');
        }
      },
    };
    return { cal: res, day };
  }

  // ─── bookings list ────────────────────────────────────────────────────────
  vBookings() {
    const s = this.state, q = s.bkQ.trim().toLowerCase(), f = s.bkFilter;
    let L = s.bookings.filter(b => {
      if (f === 'upcoming') return !b.cancelled && b.checkOut >= TODAY;
      if (f === 'due') return !b.cancelled && paidOf(b) < b.total;
      if (f === 'past') return !b.cancelled && b.checkOut < TODAY;
      if (f === 'cancel') return b.cancelled;
      return true;
    });
    if (q) L = L.filter(b => (b.name + b.phone + b.id + b.line).toLowerCase().includes(q));
    L = [...L].sort((a, b) => (f === 'upcoming' || f === 'due' ? a.checkIn.localeCompare(b.checkIn) : b.checkIn.localeCompare(a.checkIn)));
    const dd = s.settings.depositDays;
    const rows = L.slice(0, 120).map(b => {
      const x = stOf(b), due = b.cancelled ? 0 : b.total - paidOf(b), dueDate = add(b.createdAt, dd);
      let dueNote = '';
      if (due > 0) dueNote = b.status === 'unpaid' ? (dueDate < TODAY ? `มัดจำเลยกำหนด ${fD(dueDate)}` : `มัดจำภายใน ${fD(dueDate)}`) : `ชำระวันเข้าพัก ${fD(b.checkIn)}`;
      return {
        id: b.id, name: b.name, phone: b.phone, dates: `${fD(b.checkIn)} – ${fD(b.checkOut)}`, nights: diff(b.checkIn, b.checkOut),
        guests: gOf(b), rooms: this.roomsText(b), channel: b.channel, total: baht(b.total), due: due > 0 ? baht(due) : '–', dueNote,
        dueInk: b.status === 'unpaid' && dueDate < TODAY ? 'var(--color-accent-700)' : 'inherit',
        stLabel: x.label, soft: x.soft, ink: x.ink, open: () => this.openDetail(b.id),
      };
    });
    return {
      filters: [['upcoming', 'กำลังจะมาถึง'], ['due', 'ค้างชำระ'], ['past', 'เข้าพักแล้ว'], ['cancel', 'ยกเลิก'], ['all', 'ทั้งหมด']]
        .map(([key, l]) => ({ key, label: l, on: f === key, pick: () => this.setState({ bkFilter: key }) })),
      q: s.bkQ, setQ: e => this.setState({ bkQ: e.target.value }), rows,
      count: `${L.length} รายการ${L.length > 120 ? ' · แสดง 120 รายการแรก' : ''}`,
    };
  }

  // ─── today ────────────────────────────────────────────────────────────────
  vToday() {
    const s = this.state, S = s.settings, B = s.bookings.filter(b => !b.cancelled);
    const arr = B.filter(b => b.checkIn === TODAY), dep = B.filter(b => b.checkOut === TODAY);
    const stay = B.filter(b => b.checkIn <= TODAY && b.checkOut > TODAY), tom = B.filter(b => b.checkIn === add(TODAY, 1));
    const picks = arr.filter(b => b.transfer).sort((a, b) => a.pickupTime.localeCompare(b.pickupTime));
    const meals = stay.reduce((a, b) => a + gOf(b), 0);
    const cleanRooms = [...new Set(dep.flatMap(b => Object.keys(b.rooms)))].sort();
    const clean = cleanRooms.map(r => {
      const k = TODAY + r, nxt = arr.some(b => b.rooms[r]);
      return {
        id: r, name: this.roomName(r), why: `เช็คเอาท์ ${S.checkOutTime}${nxt ? ' · มีลูกค้าเข้าพักต่อ ' + S.checkInTime : ''}`,
        done: !!s.cleaned[k], toggle: () => this.setState(x => ({ cleaned: { ...x.cleaned, [k]: !x.cleaned[k] } })),
      };
    });
    return {
      kpis: [
        { label: 'เช็คอินวันนี้', value: arr.reduce((a, b) => a + gOf(b), 0), sub: `${arr.length} กลุ่ม` },
        { label: 'รถรับส่ง', value: picks.length, sub: picks.length ? `รอบแรก ${picks[0].pickupTime}` : 'ไม่มี' },
        { label: 'เตรียมอาหาร', value: meals, sub: 'ที่ (ลูกค้าพักคืนนี้)' },
        { label: 'ห้องต้องทำความสะอาด', value: cleanRooms.length, sub: `เช็คเอาท์ ${dep.length} กลุ่ม` },
      ].map((x, i) => ({ ...x, delay: i * 70 })),
      pickups: picks.map(b => ({ id: b.id, time: b.pickupTime, name: b.name, guests: gOf(b), place: b.pickupPlace, phone: b.phone, open: () => this.openDetail(b.id) })),
      clean, meals, mealCost: baht(meals * S.food),
      allergies: stay.filter(b => b.allergy).map(b => `${b.name}: ${b.allergy}`),
      arrivals: arr.map(b => {
        const x = stOf(b), due = b.total - paidOf(b);
        return { id: b.id, name: b.name, guests: gOf(b), rooms: this.roomsText(b), allergy: b.allergy, stLabel: x.label, soft: x.soft, ink: x.ink, collect: due > 0 ? `เก็บเพิ่ม ${baht(due)} บาท` : '', open: () => this.openDetail(b.id) };
      }),
      tomorrow: tom.map(b => ({ id: b.id, name: b.name, guests: gOf(b), rooms: this.roomsText(b), pickup: b.transfer ? `· รถ ${b.pickupTime} ${b.pickupPlace}` : '', open: () => this.openDetail(b.id) })),
    };
  }

  // ─── expenses ─────────────────────────────────────────────────────────────
  vExp() {
    const s = this.state, mo = TODAY.slice(0, 7);
    const L = [...s.expenses].sort((a, b) => b.date.localeCompare(a.date));
    const thisM = s.expenses.filter(e => e.date.slice(0, 7) === mo);
    return {
      kpis: [
        { label: 'ค่าใช้จ่ายเดือนนี้ (บาท)', value: baht(thisM.reduce((a, e) => a + (+e.amount || 0), 0)) },
        { label: 'เรียกเก็บคืนจากลูกค้าเดือนนี้', value: baht(thisM.reduce((a, e) => a + (+e.recovered || 0), 0)) },
        { label: 'ปัญหาที่ยังไม่เสร็จ', value: s.expenses.filter(e => e.status !== 'done').length },
      ].map((x, i) => ({ ...x, delay: i * 70 })),
      rows: L.map(e => {
        const x = EXST[e.status], b = s.bookings.find(bk => bk.id === e.bookingId);
        return {
          id: e.id, date: fDY(e.date), title: e.title, detail: e.detail, category: e.category,
          link: [e.roomId ? this.roomName(e.roomId) : '', b ? b.name : ''].filter(Boolean).join(' · ') || '–',
          reporter: e.reporter, amount: +e.amount ? baht(e.amount) : '–', recovered: +e.recovered ? baht(e.recovered) : '–',
          stLabel: x.label, soft: x.soft, ink: x.ink,
          open: () => this.setState({ modal: 'expense', ef: { ...e, photos: [...(e.photos || [])] } }),
        };
      }),
    };
  }

  // ─── customers ────────────────────────────────────────────────────────────
  custs() {
    const m = {};
    for (const b of this.state.bookings) {
      const k = b.phone || b.name;
      const c = m[k] = m[k] || { key: k, name: b.name, phone: b.phone, line: b.line, list: [], allergy: '' };
      c.list.push(b);
      if (b.allergy) c.allergy = b.allergy;
    }
    return Object.values(m);
  }

  vCust() {
    const s = this.state, q = s.custQ.trim().toLowerCase();
    let L = this.custs();
    if (q) L = L.filter(c => (c.name + c.phone + c.line).toLowerCase().includes(q));
    L.forEach(c => { c.ok = c.list.filter(b => !b.cancelled); c.last = c.ok.map(b => b.checkIn).sort().pop() || ''; });
    L.sort((a, b) => b.ok.length - a.ok.length || b.last.localeCompare(a.last));
    let cv = {};
    const c = s.custKey && this.custs().find(x => x.key === s.custKey);
    if (c) {
      cv = {
        name: c.name, phone: c.phone, line: c.line || '–', allergy: c.allergy,
        stays: [...c.list].sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map(b => {
          const x = stOf(b);
          return { id: b.id, dates: `${fD(b.checkIn)} – ${fDY(b.checkOut)}`, guests: gOf(b), total: baht(b.total), stLabel: x.label, soft: x.soft, ink: x.ink, open: () => this.openDetail(b.id) };
        }),
        rebook: () => this.openNew(TODAY, { name: c.name, phone: c.phone, line: c.line, allergy: c.allergy }),
        reviews: s.reviews.filter(r => c.list.some(b => b.id === r.bookingId)).map(r => ({ ...r, stars: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating), dateText: fDY(r.date) })),
      };
    }
    const rv = [...s.reviews].sort((a, b) => b.date.localeCompare(a.date));
    const reviews = {
      count: rv.length, avg: rv.length ? (rv.reduce((a, r) => a + r.rating, 0) / rv.length).toFixed(1) : '–',
      rows: rv.slice(0, 20).map(r => ({ ...r, stars: '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating), dateText: fDY(r.date), open: r.bookingId ? () => this.openDetail(r.bookingId) : null })),
    };
    return {
      cu: {
        q: s.custQ, setQ: e => this.setState({ custQ: e.target.value }),
        rows: L.map(x => ({
          key: x.key, name: x.name, phone: x.phone, line: x.line || '–', stays: x.ok.length,
          nights: x.ok.reduce((a, b) => a + diff(b.checkIn, b.checkOut), 0), last: x.last ? fDY(x.last) : '–',
          spent: baht(x.ok.reduce((a, b) => a + b.total, 0)), allergy: x.allergy,
          open: () => this.setState({ modal: 'customer', custKey: x.key }),
        })),
        reviews,
      },
      cv,
    };
  }

  // ─── settings ─────────────────────────────────────────────────────────────
  setS(k, v) { this.setState(s => ({ settings: { ...s.settings, [k]: v } })); }

  vSettings() {
    const s = this.state, S = s.settings;
    const num = k => e => this.setS(k, +e.target.value || 0);
    const upd = (k, id, f, v) => this.setS(k, S[k].map(x => (x.id === id ? { ...x, [f]: v } : x)));
    const sh = {
      price: num('price'), food: num('food'), maid: num('maid'), transfer: num('transfer'), depositDays: num('depositDays'),
      checkInTime: e => this.setS('checkInTime', e.target.value), checkOutTime: e => this.setS('checkOutTime', e.target.value),
      groupMin: e => this.setS('group', { ...S.group, min: +e.target.value || 0 }),
      groupPct: e => this.setS('group', { ...S.group, pct: +e.target.value || 0 }),
      backupAuto: e => this.setS('backupAuto', e.target.checked),
      promptpay: e => this.setS('promptpay', e.target.value), promptpayName: e => this.setS('promptpayName', e.target.value),
      publicUrl: e => this.setS('publicUrl', e.target.value.trim()), summaryTime: e => this.setS('summaryTime', e.target.value),
    };
    const cf = s.cf, setCf = k => e => { const v = e.target.value; this.setState(x => ({ cf: { ...x.cf, [k]: v } })); };
    const LO = [['newBooking', 'แจ้งเมื่อมีการจองใหม่'], ['requests', 'แจ้งเมื่อมีคำขอจองออนไลน์'], ['tomorrow', 'สรุปลูกค้าเข้าพักพรุ่งนี้ (ทุกวัน)'], ['due', 'แจ้งยอดมัดจำใกล้ครบกำหนด (ทุกวัน)']];
    const base = publicBase(S);
    const st = {
      fixed: S.fixed.map(f => ({
        ...f, setName: e => upd('fixed', f.id, 'name', e.target.value), setAmount: e => upd('fixed', f.id, 'amount', +e.target.value || 0),
        remove: () => this.setS('fixed', S.fixed.filter(x => x.id !== f.id)),
      })),
      addFixed: () => this.setS('fixed', [...S.fixed, { id: 'f' + Date.now(), name: 'อื่นๆ', amount: 0 }]),
      special: S.special.map(p => ({
        ...p, setName: e => upd('special', p.id, 'name', e.target.value), setFrom: e => upd('special', p.id, 'from', e.target.value),
        setTo: e => upd('special', p.id, 'to', e.target.value), setPrice: e => upd('special', p.id, 'price', +e.target.value || 0),
        remove: () => { this.setS('special', S.special.filter(x => x.id !== p.id)); this.log('ลบราคาพิเศษ', p.name); },
      })),
      addSpecial: () => {
        this.setS('special', [...S.special, { id: 's' + Date.now(), name: 'ช่วงเทศกาลใหม่', from: TODAY, to: TODAY, price: S.price }]);
        this.log('เพิ่มราคาพิเศษ', 'ช่วงเทศกาลใหม่');
      },
      rooms: S.rooms.map(r => ({ ...r, setName: e => upd('rooms', r.id, 'name', e.target.value) })),
      closures: [...s.closures].sort((a, b) => a.from.localeCompare(b.from)).map(c => ({
        id: c.id, range: c.from === c.to ? fDY(c.from) : `${fD(c.from)} – ${fDY(c.to)}`,
        room: c.room === 'all' ? 'ทั้งโฮมสเตย์' : this.roomName(c.room), reason: c.reason || '–',
        remove: () => { this.setState(x => ({ closures: x.closures.filter(y => y.id !== c.id) })); this.log('ยกเลิกการปิด', `${c.from} ${c.room}`); },
      })),
      cfFrom: setCf('from'), cfTo: setCf('to'), cfRoom: setCf('room'), cfReason: setCf('reason'),
      addClosure: () => {
        if (cf.to < cf.from) return this.flash('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม');
        this.setState(x => ({ closures: [...x.closures, { ...cf, id: 'c' + Date.now() }], cf: { ...x.cf, reason: '' } }));
        this.log('ปิดวัน / ห้อง', `${fD(cf.from)} – ${fD(cf.to)} · ${cf.room === 'all' ? 'ทั้งโฮมสเตย์' : this.roomName(cf.room)}`);
        this.flash('บันทึกการปิดแล้ว');
      },
      lineOpts: LO.map(([k, l]) => ({ key: k, label: l, on: !!S.line[k], toggle: e => this.setS('line', { ...S.line, [k]: e.target.checked }) })),
      backup: () => {
        download(`backup-${TODAY}.json`, JSON.stringify(pickData(s), null, 1), 'application/json');
        this.setS('lastBackup', nowText());
        this.log('สำรองข้อมูล', 'ดาวน์โหลดไฟล์สำรอง');
      },
      restore: e => this.restore(e),
      bookUrl: base + '/book', reviewUrl: base + '/review',
      copyBook: () => this.copy(base + '/book', 'คัดลอกลิงก์หน้าจองออนไลน์แล้ว'),
      copyReview: () => this.copy(base + '/review', 'คัดลอกลิงก์แบบประเมินแล้ว'),
      lineTest: () => this.serverCall('/api/line/test').then(r => r && this.flash(lineResult(r, 'ส่งข้อความทดสอบเข้า LINE แล้ว'))),
      lineSummary: () => this.serverCall('/api/line/summary').then(r => r && this.flash(lineResult(r, 'ส่งสรุปเข้า LINE แล้ว'))),
      resetDemo: () => this.reset('demo'),
      resetEmpty: () => this.reset('empty'),
    };
    return { S, sh, st, cf, info: s.info, net: s.net };
  }

  async reset(mode) {
    const msg = mode === 'empty'
      ? 'ล้างข้อมูลการจอง ค่าใช้จ่าย และประวัติทั้งหมดเพื่อเริ่มใช้งานจริง?\n(ระบบจะสำรองข้อมูลเดิมไว้ในเซิร์ฟเวอร์ก่อน การตั้งค่าราคา/ห้องกลับเป็นค่าเริ่มต้น)'
      : 'ล้างข้อมูลทั้งหมดและกลับไปใช้ข้อมูลตัวอย่าง?\n(ระบบจะสำรองข้อมูลเดิมไว้ในเซิร์ฟเวอร์ก่อน)';
    if (!window.confirm(msg)) return;
    this.sync.clearQueue();
    const r = await this.serverCall('/api/reset', { mode }, mode === 'empty' ? 'ล้างข้อมูลแล้ว พร้อมเริ่มใช้งานจริง' : 'รีเซ็ตเป็นข้อมูลตัวอย่างแล้ว');
    if (r) { this.setState({ modal: null }); this.sync.kick(); }
  }

  // Load a backup file downloaded earlier: every record is written back through normal sync.
  restore(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    f.text().then(t => {
      const d = JSON.parse(t);
      if (!Array.isArray(d.bookings) || !d.settings) throw new Error('bad file');
      if (!window.confirm(`กู้คืนข้อมูลจากไฟล์ ${f.name}?\nการจอง ${d.bookings.length} รายการ · ข้อมูลปัจจุบันจะถูกแทนที่`)) return;
      this.setState({ ...normalizeData(d), modal: null });
      this.log('กู้คืนข้อมูล', f.name);
      this.flash('กู้คืนข้อมูลแล้ว');
    }).catch(() => this.flash('ไฟล์สำรองไม่ถูกต้อง'));
  }

  copy(text, msg) {
    copyText(text).then(ok => this.flash(ok ? msg : 'คัดลอกไม่สำเร็จ'));
  }

  // ─── booking form ─────────────────────────────────────────────────────────
  openNew(date, pre) {
    const d = date || TODAY;
    this.setState({
      modal: 'booking', notifOpen: false,
      bf: { id: null, name: '', phone: '', line: '', checkIn: d, checkOut: add(d, 1), adults: 2, children: 0, rooms: {}, transfer: false, pickupPlace: '', pickupTime: '13:00', status: 'unpaid', slips: [], channel: 'LINE', allergy: '', note: '', ...(pre || {}) },
    });
  }
  openDetail(id) { this.setState({ modal: 'detail', detailId: id, showQR: false, confirmCancel: false, notifOpen: false }); }
  bset(k, v) {
    this.setState(s => {
      const bf = { ...s.bf, [k]: v };
      if (k === 'checkIn' && v && bf.checkOut <= v) bf.checkOut = add(v, 1);
      return { bf };
    });
  }
  avail(bf) {
    const occ = this.occMap(bf.id), ns = nightsOf(bf);
    return this.state.settings.rooms.map(r => {
      let a = r.cap, cl = false;
      ns.forEach(d => { if (this.isClosed(d, r.id)) cl = true; a = Math.min(a, r.cap - ((occ[d] || {})[r.id] || 0)); });
      return { r, a: cl ? 0 : Math.max(0, a), cl };
    });
  }
  autoAlloc() {
    const bf = this.state.bf, g = gOf(bf), av = this.avail(bf), rooms = {};
    let left = g;
    const one = av.filter(x => x.a >= g).sort((a, b) => a.r.cap - b.r.cap)[0];
    if (one) rooms[one.r.id] = g;
    else {
      for (const x of [...av].sort((a, b) => b.a - a.a)) {
        const t = Math.min(x.a, left);
        if (t > 0) { rooms[x.r.id] = t; left -= t; }
        if (!left) break;
      }
    }
    this.bset('rooms', rooms);
    if (left > 0 && !one) this.flash(`ห้องว่างไม่พอ ขาดอีก ${left} ที่`);
  }

  vForm() {
    const s = this.state, bf = s.bf;
    if (!bf) return { bf: null, fv: {}, bh: {} };
    const S = s.settings, g = gOf(bf);
    const valid = bf.checkIn && bf.checkOut && bf.checkIn < bf.checkOut;
    const ns = valid ? nightsOf(bf) : [];
    const occ = this.occMap(bf.id);
    const E = [];
    if (!bf.name.trim()) E.push('กรอกชื่อลูกค้า / ชื่อกลุ่ม');
    if (!valid) E.push('วันออกต้องอยู่หลังวันเข้าพัก');
    if (g < 1) E.push('ต้องมีผู้เข้าพักอย่างน้อย 1 คน');
    const av = valid ? this.avail(bf) : S.rooms.map(r => ({ r, a: r.cap, cl: false }));
    const roomRows = av.map(({ r, a, cl }) => {
      const c = bf.rooms[r.id] || 0;
      if (c > a) E.push(cl ? `${r.name} ปิดในช่วงวันที่เลือก` : `${r.name} รับได้อีก ${a} คนในช่วงนี้ (จัดไว้ ${c})`);
      return {
        id: r.id, name: r.name, type: r.type, cap: r.cap, count: c,
        availText: cl ? 'ปิดห้อง' : a <= 0 ? 'เต็ม' : `ว่าง ${a}/${r.cap}`,
        availInk: a <= 0 || c > a ? 'var(--color-accent-700)' : 'var(--color-neutral-700)',
        dec: () => this.bset('rooms', { ...bf.rooms, [r.id]: Math.max(0, c - 1) }),
        inc: () => this.bset('rooms', { ...bf.rooms, [r.id]: Math.min(r.cap, c + 1) }),
      };
    });
    for (const d of ns) {
      const t = ((occ[d] || {}).t || 0) + g;
      if (t > CAP) { E.push(`คืน ${fD(d)} จะมีผู้เข้าพักรวม ${t} คน เกินความจุ ${CAP} คน`); break; }
    }
    const alloc = Object.values(bf.rooms).reduce((a, b) => a + b, 0);
    if (g > 0 && alloc !== g) E.push(`จัดห้องแล้ว ${alloc} จาก ${g} คน`);
    const old = bf.id && s.bookings.find(b => b.id === bf.id);
    if (old && old.rescheduled && (old.checkIn !== bf.checkIn || old.checkOut !== bf.checkOut)) E.push('การจองนี้เลื่อนวันไปแล้ว 1 ครั้ง (นโยบายเลื่อนได้ 1 ครั้ง)');
    const t = valid && g > 0 ? calcTotal(bf.checkIn, bf.checkOut, g, S) : { n: 0, gross: 0, disc: 0, total: 0, lines: [] };
    const q = bf.name.trim().toLowerCase();
    const sugs = (!bf.id && q && !bf.phone)
      ? this.custs().filter(c => c.name.toLowerCase().includes(q)).slice(0, 4).map(c => ({
        key: c.key, name: c.name, meta: `${c.phone} · เคยพัก ${c.list.length} ครั้ง`,
        pick: () => this.setState(x => ({ bf: { ...x.bf, name: c.name, phone: c.phone, line: c.line, allergy: c.allergy || x.bf.allergy } })),
      }))
      : [];
    const bh = {};
    ['name', 'phone', 'line', 'checkIn', 'checkOut', 'pickupPlace', 'pickupTime', 'allergy', 'note'].forEach(k => { bh[k] = e => this.bset(k, e.target.value); });
    bh.adults = e => this.bset('adults', Math.max(0, +e.target.value || 0));
    bh.children = e => this.bset('children', Math.max(0, +e.target.value || 0));
    bh.transfer = e => this.bset('transfer', e.target.checked);
    bh.slips = e => this.uploadInto(e, files => this.setState(x => (x.bf ? { bf: { ...x.bf, slips: [...x.bf.slips, ...files] } } : null)));
    const created = bf.createdAt || TODAY;
    const errors = [...new Set(E)];
    return {
      bf, bh,
      fv: {
        title: bf.id ? `แก้ไขการจอง ${bf.id}` : 'การจองใหม่', roomRows, errors, hasErrors: errors.length > 0, sugs,
        summary: valid ? `${fD(bf.checkIn)} – ${fDY(bf.checkOut)} · ${t.n} คืน · ${g} คน (ผู้ใหญ่ ${bf.adults} เด็ก ${bf.children})` : 'เลือกวันเข้าพัก',
        lines: t.lines, hasDisc: t.disc > 0, disc: baht(t.disc), discLabel: `ส่วนลดกลุ่ม ${S.group.pct}% (${S.group.min} คนขึ้นไป)`,
        total: baht(t.total), deposit: baht(t.total / 2), balance: baht(t.total - Math.round(t.total / 2)), depositDue: fD(add(created, S.depositDays)),
        statusOpts: Object.entries(ST).map(([k, v]) => ({ key: k, label: v.label, on: bf.status === k, pick: () => this.bset('status', k) })),
        channelOpts: CHANNELS.map(c => ({ key: c, label: c, on: bf.channel === c, pick: () => this.bset('channel', c) })),
      },
    };
  }

  saveBooking() {
    const s = this.state, bf = s.bf;
    if (this.vForm().fv.hasErrors) return;
    const t = calcTotal(bf.checkIn, bf.checkOut, gOf(bf), s.settings);
    const rooms = {};
    for (const k in bf.rooms) if (bf.rooms[k] > 0) rooms[k] = bf.rooms[k];
    if (bf.id) {
      const old = s.bookings.find(b => b.id === bf.id);
      const moved = old.checkIn !== bf.checkIn || old.checkOut !== bf.checkOut;
      const nb = { ...old, ...bf, rooms, total: t.total, rescheduled: old.rescheduled || moved };
      const ch = [];
      if (moved) ch.push(`เลื่อนวัน ${fD(old.checkIn)} → ${fD(bf.checkIn)}`);
      if (old.total !== t.total) ch.push(`ยอด ${baht(old.total)} → ${baht(t.total)}`);
      if (old.status !== bf.status) ch.push(`${ST[old.status].label} → ${ST[bf.status].label}`);
      this.setState({ bookings: s.bookings.map(b => (b.id === bf.id ? nb : b)), modal: 'detail', detailId: bf.id });
      this.log('แก้ไขการจอง', `${bf.id} ${bf.name}${ch.length ? ' · ' + ch.join(' · ') : ''}`);
      this.flash('บันทึกการแก้ไขแล้ว');
    } else {
      const n = Math.max(0, ...s.bookings.map(b => +String(b.id).slice(3) || 0)) + 1;
      const id = 'KT-' + String(n).padStart(4, '0');
      const { requestId, ...rest } = bf;
      const nb = { ...rest, id, uid: randomToken(8), token: randomToken(), rooms, total: t.total, createdAt: TODAY, rescheduled: false, cancelled: false, surveySent: false };
      this.setState(x => ({
        bookings: [...x.bookings, nb], modal: 'detail', detailId: id,
        requests: requestId ? x.requests.filter(r => r.id !== requestId) : x.requests,
      }));
      this.log('สร้างการจอง', `${id} ${bf.name} · ${fD(bf.checkIn)} · ${gOf(bf)} คน · ${baht(t.total)} บาท${requestId ? ' · จากคำขอออนไลน์ ' + requestId : ''}`);
      this.flash(s.settings.line.newBooking && s.info && s.info.line ? 'บันทึกการจองแล้ว · ส่งแจ้งเตือนเข้า LINE' : 'บันทึกการจองแล้ว');
    }
  }

  // Upload chosen images, then hand the stored {name,url} list to `done`.
  uploadInto(e, done) {
    const list = [...e.target.files];
    e.target.value = '';
    if (!list.length) return;
    this.flash(`กำลังอัปโหลด ${list.length} รูป…`);
    uploadAll(list).then(({ files, failed }) => {
      done(files);
      this.flash(failed.length ? `อัปโหลดไม่สำเร็จ ${failed.length} รูป (บันทึกเฉพาะชื่อไฟล์)` : `อัปโหลดแล้ว ${files.length} รูป`);
    });
  }

  // ─── online booking requests ──────────────────────────────────────────────
  acceptRequest(r) {
    this.openNew(r.checkIn, {
      requestId: r.id, name: r.name, phone: r.phone, line: r.line, checkIn: r.checkIn, checkOut: r.checkOut,
      adults: r.adults, children: r.children, transfer: r.transfer, pickupPlace: r.pickupPlace, pickupTime: r.pickupTime || '13:00',
      allergy: r.allergy, note: r.note, channel: 'ออนไลน์',
    });
    setTimeout(() => this.autoAlloc(), 0);
  }

  rejectRequest(r) {
    if (!window.confirm(`ปฏิเสธคำขอจองของ ${r.name}?`)) return;
    this.setState(x => ({ requests: x.requests.filter(y => y.id !== r.id) }));
    this.log('ปฏิเสธคำขอจองออนไลน์', `${r.id} ${r.name} · ${fD(r.checkIn)}`);
  }

  updB(id, patch, action, detail) {
    this.setState(s => ({ bookings: s.bookings.map(b => (b.id === id ? { ...b, ...patch } : b)) }));
    if (action) this.log(action, detail);
  }

  // ─── booking detail + documents ───────────────────────────────────────────
  vDetail() {
    const s = this.state, b = s.detailId && s.bookings.find(x => x.id === s.detailId);
    if (!b) return { dv: null, doc: null };
    const x = stOf(b), paid = paidOf(b), due = b.cancelled ? 0 : b.total - paid, dueDate = add(b.createdAt, s.settings.depositDays);
    const dv = {
      id: b.id, name: b.name, created: fDY(b.createdAt), channel: b.channel, stLabel: x.label, soft: x.soft, ink: x.ink,
      facts: [
        { k: 'เข้าพัก – ออก', v: `${fD(b.checkIn)} – ${fDY(b.checkOut)} (${diff(b.checkIn, b.checkOut)} คืน)` },
        { k: 'ผู้เข้าพัก', v: `${gOf(b)} คน · ผู้ใหญ่ ${b.adults} เด็ก ${b.children}` },
        { k: 'ห้อง', v: this.roomsText(b) },
        { k: 'ติดต่อ', v: `${b.phone || '–'} · LINE ${b.line || '–'}` },
        { k: 'รถรับส่ง', v: b.transfer ? `${b.pickupTime} · ${b.pickupPlace}` : 'ไม่ใช้' },
        { k: 'ประวัติ', v: b.rescheduled ? 'ใช้สิทธิ์เลื่อนวันแล้ว' : 'ยังไม่เคยเลื่อนวัน' },
      ],
      noteText: [b.allergy && 'ความต้องการพิเศษ: ' + b.allergy, b.note && 'หมายเหตุ: ' + b.note].filter(Boolean).join(' · '),
      total: baht(b.total), paid: baht(paid), due: baht(due), dueInk: due > 0 ? 'var(--color-accent-700)' : 'inherit',
      dueNote: due > 0 ? (b.status === 'unpaid' ? `มัดจำ ${baht(b.total / 2)} ภายใน ${fD(dueDate)}` : `ชำระวันเข้าพัก ${fD(b.checkIn)}`) : '',
      active: !b.cancelled, isPaid: b.status === 'paid' && !b.cancelled, canSurvey: !b.cancelled && b.checkOut <= TODAY,
      surveyLabel: b.surveySent ? 'ส่งแบบประเมินแล้ว · ส่งอีกครั้ง' : 'ส่งแบบประเมินความพึงพอใจ',
      slips: b.slips || [], qrLabel: b.status === 'unpaid' ? 'ยอดมัดจำ 50%' : 'ยอดคงเหลือ', qrAmt: baht(b.status === 'unpaid' ? b.total / 2 : due),
      qrAmount: Math.round(b.status === 'unpaid' ? b.total / 2 : due), promptpay: s.settings.promptpay, promptpayName: s.settings.promptpayName,
      reviews: s.reviews.filter(r => r.bookingId === b.id),
      statusOpts: Object.entries(ST).map(([k, v]) => ({
        key: k, label: v.label, on: b.status === k,
        pick: () => this.updB(b.id, { status: k }, 'เปลี่ยนสถานะชำระเงิน', `${b.id} ${b.name}: ${ST[b.status].label} → ${v.label}`),
      })),
    };
    const t = calcTotal(b.checkIn, b.checkOut, gOf(b), s.settings), rc = s.docType === 'receipt';
    const doc = {
      title: rc ? 'ใบเสร็จรับเงิน' : 'ใบยืนยันการจอง', no: (rc ? 'RC-' : 'CF-') + b.id.slice(3), date: fDY(TODAY),
      name: b.name, phone: b.phone, stay: `${fD(b.checkIn)} – ${fDY(b.checkOut)} · ${gOf(b)} คน · ${this.roomsText(b)}`,
      lines: t.lines, hasDisc: t.disc > 0, disc: baht(t.disc), transfer: b.transfer, pickup: `${b.pickupPlace} ${b.pickupTime}`,
      total: baht(b.total), paid: baht(paid), due: baht(due),
      qrAmount: due > 0 ? dv.qrAmount : 0, qrLabel: dv.qrLabel, promptpay: s.settings.promptpay, promptpayName: s.settings.promptpayName,
    };
    return { dv, doc };
  }

  // ─── expense form ─────────────────────────────────────────────────────────
  vExpForm() {
    const s = this.state, ef = s.ef;
    if (!ef) return { ef: null, ev: {}, eh: {} };
    const eh = {};
    ['date', 'category', 'title', 'detail', 'roomId', 'bookingId', 'reporter'].forEach(k => { eh[k] = e => { const v = e.target.value; this.setState(x => ({ ef: { ...x.ef, [k]: v } })); }; });
    ['amount', 'recovered'].forEach(k => { eh[k] = e => { const v = +e.target.value || 0; this.setState(x => ({ ef: { ...x.ef, [k]: v } })); }; });
    eh.photos = e => this.uploadInto(e, files => this.setState(x => (x.ef ? { ef: { ...x.ef, photos: [...x.ef.photos, ...files] } } : null)));
    const near = s.bookings
      .filter(b => !b.cancelled && b.checkOut >= add(ef.date || TODAY, -14) && b.checkIn <= add(ef.date || TODAY, 1))
      .map(b => ({ id: b.id, label: `${b.name} · ${fD(b.checkIn)}` }));
    return {
      ef, eh,
      ev: {
        title: ef.id ? 'แก้ไขรายการ ' + ef.id : 'แจ้งปัญหาใหม่', isEdit: !!ef.id, invalid: !ef.title.trim(), bookingOpts: near,
        statusOpts: Object.entries(EXST).map(([k, v]) => ({ key: k, label: v.label, on: ef.status === k, pick: () => this.setState(x => ({ ef: { ...x.ef, status: k } })) })),
      },
    };
  }

  saveExpense() {
    const s = this.state, ef = s.ef;
    if (!ef.title.trim()) return;
    if (ef.id) {
      this.setState({ expenses: s.expenses.map(e => (e.id === ef.id ? ef : e)), modal: null });
      this.log('แก้ไขรายการแจ้งปัญหา', `${ef.id} ${ef.title} · ${baht(ef.amount)} บาท · ${EXST[ef.status].label}`);
    } else {
      const n = Math.max(0, ...s.expenses.map(e => +e.id.slice(2))) + 1;
      const id = 'E-' + String(n).padStart(3, '0');
      this.setState({ expenses: [...s.expenses, { ...ef, id }], modal: null });
      this.log('แจ้งปัญหา', `${id} ${ef.title} · ${baht(ef.amount)} บาท`);
    }
    this.flash('บันทึกแล้ว');
  }

  // ─── notifications ────────────────────────────────────────────────────────
  vNotifs() {
    const s = this.state, S = s.settings, B = s.bookings.filter(b => !b.cancelled), L = [];
    if (S.line.newBooking) B.filter(b => b.createdAt === TODAY).forEach(b => L.push({ kind: 'การจองใหม่', text: `${b.name} · ${gOf(b)} คน`, meta: `${fD(b.checkIn)} – ${fD(b.checkOut)} · ${baht(b.total)} บาท`, id: b.id }));
    if (S.line.tomorrow) B.filter(b => b.checkIn === add(TODAY, 1)).forEach(b => L.push({ kind: 'เข้าพักพรุ่งนี้', text: `${b.name} · ${gOf(b)} คน · ${this.roomsText(b)}`, meta: b.transfer ? `รถรับ ${b.pickupTime} ที่ ${b.pickupPlace}` : 'ไม่ใช้รถรับส่ง', id: b.id }));
    if (S.line.due) {
      B.filter(b => b.status === 'unpaid' && add(b.createdAt, S.depositDays) <= add(TODAY, 1)).forEach(b => {
        const d = add(b.createdAt, S.depositDays);
        L.push({ kind: d < TODAY ? 'มัดจำเลยกำหนด' : 'มัดจำใกล้ครบกำหนด', text: `${b.name} · ${baht(b.total / 2)} บาท`, meta: `ครบกำหนด ${fD(d)} · เข้าพัก ${fD(b.checkIn)}`, id: b.id });
      });
    }
    const out = s.requests.map(r => ({
      kind: 'คำขอจองออนไลน์', text: `${r.name} · ${(+r.adults || 0) + (+r.children || 0)} คน`,
      meta: `${fD(r.checkIn)} – ${fD(r.checkOut)} · ${r.phone}`, id: r.id, key: 'rq' + r.id,
      open: () => { this.setState({ page: 'bookings', notifOpen: false }); window.scrollTo(0, 0); },
    }));
    return out.concat(L.map((x, i) => ({ ...x, key: x.kind + x.id + i, open: () => this.openDetail(x.id) })));
  }

  // Text sent to the customer for the confirmation / receipt, with a link to their payment page.
  docText(b, rc) {
    const S = this.state.settings, paid = paidOf(b), due = b.cancelled ? 0 : b.total - paid;
    const lines = [
      `คะนึงถึงโฮมสเตย์ · ${rc ? 'ใบเสร็จรับเงิน RC-' : 'ใบยืนยันการจอง CF-'}${b.id.slice(3)}`,
      `คุณ${b.name.replace(/^คุณ/, '')}`,
      `เข้าพัก ${fD(b.checkIn)} – ${fDY(b.checkOut)} · ${gOf(b)} คน · ${this.roomsText(b)}`,
      `เช็คอิน ${S.checkInTime} · เช็คเอาท์ ${S.checkOutTime}`,
      b.transfer ? `รถรับส่งฟรี ${b.pickupTime} ที่ ${b.pickupPlace}` : '',
      `ยอดรวม ${baht(b.total)} บาท · ชำระแล้ว ${baht(paid)} บาท${due > 0 ? ` · คงเหลือ ${baht(due)} บาท` : ''}`,
      due > 0 && b.status === 'unpaid' ? `กรุณาชำระมัดจำ 50% (${baht(b.total / 2)} บาท) ภายใน ${fD(add(b.createdAt, S.depositDays))}` : '',
      `รายละเอียดและ QR ชำระเงิน: ${this.bookingUrl(b, 'pay')}`,
    ];
    return lines.filter(Boolean).join('\n');
  }

  // ─── view model ───────────────────────────────────────────────────────────
  renderVals() {
    const s = this.state;
    this.occ = this.occMap();
    const notifs = this.vNotifs();
    const B = s.bookings.filter(b => !b.cancelled);
    const badges = {
      today: B.filter(b => b.checkIn === TODAY).length,
      expenses: s.expenses.filter(e => e.status !== 'done').length,
      bookings: B.filter(b => b.status === 'unpaid' && b.checkOut >= TODAY).length + s.requests.length,
    };
    const net = s.net, hm = d => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const syncText = net.online
      ? (net.pending ? `กำลังส่ง ${net.pending} รายการ` : `ออนไลน์ · อัปเดต ${net.lastSync ? hm(net.lastSync) : ''}`)
      : `ออฟไลน์${net.pending ? ` · รอส่ง ${net.pending} รายการ` : ' · ใช้ข้อมูลในเครื่อง'}`;
    const navItems = Object.keys(NAVL).map(k => ({ key: k, label: NAVL[k], active: s.page === k, go: () => { this.setState({ page: k, notifOpen: false }); window.scrollTo(0, 0); }, badge: badges[k] || 0 }));
    const td = pd(TODAY);
    const b = s.detailId && s.bookings.find(x => x.id === s.detailId);
    const out = {
      page: s.page, navIndex: Object.keys(NAVL).indexOf(s.page), clock: s.clock, narrow: s.narrow, navItems, pageTitle: PAGES[s.page],
      todayText: `วัน${DOWF[td.getUTCDay()]}ที่ ${td.getUTCDate()} ${TH_MF[td.getUTCMonth()]} ${td.getUTCFullYear() + 543}`,
      deviceOpts: DEVICES.map(d => ({ key: d.id, label: d.label.split(' · ')[0], on: s.device === d.id, pick: () => this.setState({ device: d.id }) })),
      syncText, online: net.online, needPin: net.needPin, loaded: s.loaded,
      notifs, notifOpen: s.notifOpen, toggleNotif: () => this.setState(x => ({ notifOpen: !x.notifOpen })), closeNotif: () => this.setState({ notifOpen: false }),
      newBooking: () => this.openNew(TODAY),
      legend: [ST.unpaid, ST.deposit, ST.paid, { label: 'ปิด', bg: 'var(--color-neutral-300)' }],
      checkInTime: s.settings.checkInTime, checkOutTime: s.settings.checkOutTime, depositDays: s.settings.depositDays, cats: CATS,
      modal: s.modal, closeModal: () => this.setState({ modal: null }),
      toast: s.toast, showQR: s.showQR, confirmCancel: s.confirmCancel,
      exportExcel: () => this.exportExcel(), exportPdf: () => window.print(), autoAlloc: () => this.autoAlloc(), saveBooking: () => this.saveBooking(),
      editBooking: () => this.setState({ modal: 'booking', bf: { ...b, rooms: { ...b.rooms }, slips: [...(b.slips || [])] } }),
      toggleQR: () => this.setState(x => ({ showQR: !x.showQR })),
      sendQR: () => {
        if (!s.settings.promptpay) return this.flash('ตั้งเลขพร้อมเพย์ในหน้าตั้งค่าก่อน');
        const bk = this.ensureToken(b), amt = b.status === 'unpaid' ? b.total / 2 : b.total - paidOf(b);
        this.share(`คะนึงถึงโฮมสเตย์ · ${b.status === 'unpaid' ? 'ยอดมัดจำ 50%' : 'ยอดคงเหลือ'} ${baht(amt)} บาท\nสแกน QR พร้อมเพย์ได้ที่ลิงก์นี้\n${this.bookingUrl(bk, 'pay')}`, 'เปิด LINE เพื่อส่ง QR ให้ลูกค้าแล้ว');
        this.log('ส่ง QR พร้อมเพย์', `${b.id} ${b.name} · ${baht(amt)} บาท`);
      },
      attachSlip: e => this.uploadInto(e, files => {
        const cur = this.state.bookings.find(x => x.id === b.id);
        this.updB(b.id, { slips: [...(cur.slips || []), ...files] }, 'แนบสลิป', `${b.id} ${b.name} · ${files.map(f => f.name).join(', ')}`);
      }),
      openConfirmDoc: () => this.setState({ modal: 'doc', docType: 'confirm' }), openReceipt: () => this.setState({ modal: 'doc', docType: 'receipt' }),
      backToDetail: () => this.setState({ modal: 'detail' }),
      sendDoc: () => {
        const bk = this.ensureToken(b);
        this.share(this.docText(bk, s.docType === 'receipt'), 'เปิด LINE เพื่อส่งเอกสารให้ลูกค้าแล้ว');
      },
      sendSurvey: () => {
        const bk = this.ensureToken(b);
        this.share(`ขอบคุณที่มาพักกับคะนึงถึงโฮมสเตย์ 🙏\nรบกวนให้คะแนนความพึงพอใจสั้นๆ ได้ที่\n${this.bookingUrl(bk, 'review')}`, 'เปิด LINE เพื่อส่งแบบประเมินแล้ว');
        this.updB(b.id, { surveySent: true }, 'ส่งแบบประเมิน', `${b.id} ${b.name}`);
      },
      copyPayLink: () => { const bk = this.ensureToken(b); this.copy(this.bookingUrl(bk, 'pay'), 'คัดลอกลิงก์หน้าชำระเงินแล้ว'); },
      askCancel: () => this.setState({ confirmCancel: true }), noCancel: () => this.setState({ confirmCancel: false }),
      doCancel: () => {
        this.updB(b.id, { cancelled: true }, 'ยกเลิกการจอง', `${b.id} ${b.name} · ไม่คืนมัดจำ ${baht(paidOf(b))} บาท`);
        this.setState({ confirmCancel: false });
        this.flash('ยกเลิกการจองแล้ว');
      },
      newExpense: () => this.setState({ modal: 'expense', ef: { id: null, date: TODAY, title: '', detail: '', amount: 0, category: CATS[0], reporter: this.dev(), bookingId: '', roomId: '', status: 'todo', recovered: 0, photos: [] } }),
      saveExpense: () => this.saveExpense(),
      deleteExpense: () => {
        const ef = s.ef;
        this.setState(x => ({ expenses: x.expenses.filter(e => e.id !== ef.id), modal: null }));
        this.log('ลบรายการแจ้งปัญหา', `${ef.id} ${ef.title}`);
      },
      auditRows: s.audit,
      requests: [...s.requests].sort((a, c) => a.checkIn.localeCompare(c.checkIn)).map(r => ({
        ...r, guests: (+r.adults || 0) + (+r.children || 0), dates: `${fD(r.checkIn)} – ${fDY(r.checkOut)}`, nights: diff(r.checkIn, r.checkOut),
        estimateText: baht(r.estimate), accept: () => this.acceptRequest(r), reject: () => this.rejectRequest(r),
      })),
    };
    if (s.page === 'dashboard') out.dash = this.vDash();
    if (s.page === 'calendar') Object.assign(out, this.vCal());
    if (s.page === 'bookings') out.bk = this.vBookings();
    if (s.page === 'today') out.td = this.vToday();
    if (s.page === 'expenses') out.ex = this.vExp();
    Object.assign(out, this.vCust(), this.vSettings(), this.vForm(), this.vDetail(), this.vExpForm());
    return out;
  }

  render() {
    const s = this.state;
    if (s.net.needPin) return <PinGate wrong={!!getPin()} onSubmit={pin => { setPin(pin); this.sync.retryWithPin(); this.loadInfo(); }} />;
    if (!s.loaded && !s.checked) return <div className="splash">กำลังโหลดข้อมูล…</div>;
    const v = this.renderVals();
    const P = {
      dashboard: Dashboard, calendar: Calendar, bookings: Bookings, today: Today,
      expenses: Expenses, customers: Customers, settings: Settings, audit: Audit,
    }[v.page];
    return (
      <div className="app" data-modal={v.modal || ''}>
        {!v.narrow && <Sidebar v={v} />}
        <main className="app-main">
          <Header v={v} />
          {v.narrow && (
            <div className="nav-strip">
              {v.navItems.map(n => (
                <button key={n.key} onClick={n.go} className={n.active ? 'is-active' : ''}>{n.label}</button>
              ))}
            </div>
          )}
          <div className="page">
            <P key={v.page} v={v} />
          </div>
        </main>
        {v.modal === 'booking' && v.bf && <BookingForm v={v} />}
        {v.modal === 'detail' && v.dv && <BookingDetail v={v} />}
        {v.modal === 'doc' && v.doc && <DocumentView v={v} />}
        {v.modal === 'expense' && v.ef && <ExpenseForm v={v} />}
        {v.modal === 'customer' && v.cv.name && <CustomerDetail v={v} />}
        {v.toast && <Toast text={v.toast} />}
      </div>
    );
  }
}
