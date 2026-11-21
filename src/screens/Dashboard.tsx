/** 7. สรุปผล (Dashboard) — วัน/เดือน/ปี/กำหนดเอง · KPI เทียบช่วงก่อนหน้า · กราฟแท่ง · ต้นทุนแยกประเภท · Export (FR-12, FR-13) */
import { useMemo, useRef, useState } from 'react';
import { Download, FileText, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { toJpeg } from 'html-to-image';
import { useStore } from '../lib/store';
import { Field, IC, IC16, Seg, toast } from '../app/ui';
import { exportReport } from '../lib/exports';
import { jpegToPdf, shareFile, dataUrlToBlob } from '../lib/share';
import { report, type Report } from '../domain/costs';
import { addDays, addMonths, diffDays, endOfMonth, fmtDate, fmtMonth, startOfMonth, todayISO, TH_MONTHS_SHORT, beYear } from '../domain/dates';
import { fmtBaht, fmtNum } from '../domain/money';
import { CHANNEL_LABEL } from '../domain/defaults';
import type { Channel } from '../domain/types';

type Period = 'day' | 'month' | 'year' | 'custom';

function rangeOf(p: Period, today: string, custom: { from: string; to: string }): { from: string; to: string; label: string; prev: { from: string; to: string }; basis: string } {
  if (p === 'day') return { from: today, to: today, label: `วันนี้ ${fmtDate(today)}`, prev: { from: addDays(today, -1), to: addDays(today, -1) }, basis: 'เทียบกับเมื่อวาน' };
  if (p === 'month') {
    const f = startOfMonth(today);
    const pf = addMonths(f, -1);
    return { from: f, to: endOfMonth(f), label: fmtMonth(f.slice(0, 7)), prev: { from: pf, to: endOfMonth(pf) }, basis: `เทียบกับ${fmtMonth(pf.slice(0, 7))}` };
  }
  if (p === 'year') {
    const y = Number(today.slice(0, 4));
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `ปี ${beYear(y)}`, prev: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }, basis: `เทียบกับปี ${beYear(y - 1)}` };
  }
  const n = diffDays(custom.from, custom.to) + 1;
  return { from: custom.from, to: custom.to, label: `${fmtDate(custom.from)} – ${fmtDate(custom.to)}`, prev: { from: addDays(custom.from, -n), to: addDays(custom.from, -1) }, basis: `เทียบกับ ${n} วันก่อนหน้า` };
}

export function Dashboard() {
  const ds = useStore((s) => s.ds);
  const today = todayISO();
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState({ from: startOfMonth(today), to: today });
  const rng = rangeOf(period, today, custom);
  const data = { ...ds, housekeepingCost: ds.settings.housekeepingCost };
  const r = useMemo(() => report(rng.from, rng.to, data), [rng.from, rng.to, ds]); // eslint-disable-line
  const p = useMemo(() => report(rng.prev.from, rng.prev.to, data), [rng.prev.from, rng.prev.to, ds]); // eslint-disable-line
  const spark = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(today), i - 5));
    return months.map((m) => report(m, endOfMonth(m), data));
  }, [ds, today]); // eslint-disable-line
  const pdfRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const kpis = [
    { label: 'รายรับรวม', value: fmtBaht(r.revenue), d: delta(r.revenue, p.revenue), sp: spark.map((x) => x.revenue) },
    { label: 'กำไรสุทธิ', value: fmtBaht(r.profit), d: delta(r.profit, p.profit), sp: spark.map((x) => x.profit) },
    { label: `ยอดค้างชำระ · ${r.outstandingCount} การจอง`, value: fmtBaht(r.outstanding), d: delta(r.outstanding, p.outstanding, true), sp: spark.map((x) => x.outstanding) },
    { label: 'อัตราการเข้าพัก', value: `${r.occupancyPeople.toFixed(0)}%`, d: deltaPts(r.occupancyPeople, p.occupancyPeople), sp: spark.map((x) => x.occupancyPeople) },
  ];

  // กราฟ: รายวัน (เดือน/กำหนดเอง) · รายเดือน (ปี) · คนต่อห้อง (วัน)
  let chartTitle = 'รายรับรายวัน (ตามคืนที่เข้าพัก)';
  let bars: Array<{ v: number; label: string; tip: string; hi?: boolean }> = [];
  if (period === 'year') {
    chartTitle = 'รายรับรายเดือน';
    const y = rng.from.slice(0, 4);
    bars = Array.from({ length: 12 }, (_, i) => {
      const m = `${y}-${String(i + 1).padStart(2, '0')}`;
      let v = 0;
      for (const [d, a] of r.revenueByDay) if (d.startsWith(m)) v += a;
      return { v, label: TH_MONTHS_SHORT[i]!.replace('.', ''), tip: `${TH_MONTHS_SHORT[i]} ${fmtBaht(v)}`, hi: today.startsWith(m) };
    });
  } else if (period === 'day') {
    chartTitle = 'แขกคืนนี้แยกตามห้อง';
    bars = ds.rooms.filter((x) => x.isActive).map((room) => {
      const n = ds.bookings.filter((b) => ['confirmed', 'checked_in', 'checked_out'].includes(b.status) && b.checkIn <= today && today < b.checkOut).reduce((s, b) => s + (b.rooms.find((a) => a.roomId === room.id)?.guests ?? 0), 0);
      return { v: n, label: room.name.replace('ห้อง ', 'ห้อง'), tip: `${room.name} ${n}/${room.capacity} คน` };
    });
  } else {
    const entries = [...r.revenueByDay];
    const every = entries.length > 40 ? 10 : 5;
    bars = entries.map(([d, v], i) => ({ v, label: i === 0 || (Number(d.slice(8)) % every === 0 && entries.length - i > 2) ? String(Number(d.slice(8))) : '', tip: `${fmtDate(d)} ${fmtBaht(v)}`, hi: d === today }));
  }
  const maxBar = Math.max(1, ...bars.map((b) => b.v));

  const costs = [
    { label: 'อาหาร', value: r.meal, color: 'var(--color-primary)' },
    { label: 'แม่บ้าน', value: r.housekeeping, color: 'var(--color-secondary)' },
    { label: 'รถรับส่ง', value: r.transport, color: 'var(--color-info)' },
    { label: 'แจ้งปัญหา', value: r.issueCost, color: 'var(--color-tertiary)' },
    { label: 'ต้นทุนคงที่', value: r.fixed, color: '#8A8F8B' },
  ];
  const topRoom = [...r.roomNightsByRoom].sort((a, b) => b[1] - a[1])[0];
  const topChannel = [...r.channelCount].sort((a, b) => b[1] - a[1])[0];

  async function pdf() {
    setBusy(true);
    try {
      const url = await toJpeg(pdfRef.current!, { pixelRatio: 2, backgroundColor: '#FFFFFF', quality: 0.92 });
      const img = new Image();
      img.src = url;
      await img.decode();
      const blob = jpegToPdf(new Uint8Array(await dataUrlToBlob(url).arrayBuffer()), img.naturalWidth, img.naturalHeight);
      const res = await shareFile(blob, `รายงาน-${rng.from}-${rng.to}.pdf`, `รายงาน ${rng.label}`);
      if (res === 'downloaded') toast('บันทึก PDF แล้ว');
    } catch (e) {
      console.error(e);
      toast('สร้าง PDF ไม่สำเร็จ', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <Seg value={period} onChange={setPeriod} label="ช่วงเวลา" options={[{ v: 'day', label: 'วันนี้' }, { v: 'month', label: 'เดือนนี้' }, { v: 'year', label: 'ปีนี้' }, { v: 'custom', label: 'เลือกช่วงวัน' }]} />
      {period === 'custom' && (
        <div className="grid-2" style={{ gap: 12 }}>
          <Field label="ตั้งแต่">
            <input className="input" type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} />
          </Field>
          <Field label="ถึง">
            <input className="input" type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} />
          </Field>
        </div>
      )}
      <div className="small muted" style={{ marginTop: -6 }}>
        {rng.label} · {rng.basis}
      </div>
      <div className="kpis">
        {kpis.map((k) => (
          <div key={k.label} className="kpi">
            <span className="small muted">{k.label}</span>
            <span className="v">{k.value}</span>
            <div className="row between" style={{ gap: 6 }}>
              <span className="row xs b nowrap" style={{ gap: 4, color: k.d.fg }}>
                {k.d.icon}
                {k.d.txt}
              </span>
              <Spark values={k.sp} />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">{chartTitle}</div>
        <div className="bars-chart" role="img" aria-label={chartTitle}>
          {bars.map((b, i) => (
            <div key={i} title={b.tip}>
              <div style={{ height: `${(b.v / maxBar) * 100}%`, background: b.hi ? 'var(--color-accent)' : undefined }} />
            </div>
          ))}
        </div>
        <div className="bars-labels">
          {bars.map((b, i) => (
            <div key={i}>{b.label}</div>
          ))}
        </div>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <div className="card">
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <span className="card-title">ต้นทุนแยกประเภท</span>
            <span className="b num">{fmtBaht(r.costTotal)}</span>
          </div>
          <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 2, background: 'var(--color-surface-2)' }}>
            {costs.filter((c) => c.value > 0).map((c) => (
              <div key={c.label} style={{ width: `${(c.value / Math.max(1, r.costTotal)) * 100}%`, background: c.color }} />
            ))}
          </div>
          {costs.map((c) => (
            <div key={c.label} className="row" style={{ gap: 10, fontSize: 15 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color, flex: 'none' }} />
              <span className="grow">{c.label}</span>
              <span className="b num">{fmtBaht(c.value)}</span>
            </div>
          ))}
          {(r.recovered > 0 || r.forfeits > 0) && (
            <div className="small muted divider" style={{ paddingTop: 8 }}>
              {r.recovered > 0 && `เรียกเก็บคืนจากลูกค้า ${fmtBaht(r.recovered)} `}
              {r.forfeits > 0 && `มัดจำที่ไม่คืนจากการยกเลิก ${fmtBaht(r.forfeits)} `}
              (รวมในรายรับแล้ว)
            </div>
          )}
        </div>
        <div className="card tight">
          {[
            ['ลูกค้าที่เข้าพัก', `${fmtNum(r.arrivalGuests)} คน · ${r.arrivals} การจอง`],
            ['คืน-คนที่ขายได้', `${fmtNum(r.guestNights)} คืน-คน`],
            ['อัตราการเข้าพัก (ห้อง)', `${r.occupancyRooms.toFixed(0)}%`],
            ['ห้องที่ถูกจองบ่อยที่สุด', topRoom ? `${ds.rooms.find((x) => x.id === topRoom[0])?.name ?? '–'} · ${topRoom[1]} คืน` : '–'],
            ['ช่องทางที่จองมาเยอะที่สุด', topChannel ? `${CHANNEL_LABEL[topChannel[0] as Channel]} · ${topChannel[1]} ครั้ง` : '–'],
            ['รายรับคิดตาม', 'วันที่เข้าพัก'],
          ].map(([l, v]) => (
            <div key={l} className="row between" style={{ gap: 12, padding: '8px 0', borderBottom: '1px solid var(--color-surface-2)', fontSize: 15 }}>
              <span className="muted">{l}</span>
              <span className="b right">{v}</span>
            </div>
          ))}
          <div className="row gap8" style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-secondary grow" onClick={() => exportReport(ds, rng.from, rng.to, rng.label)}>
              <Download {...IC} />
              Excel
            </button>
            <button type="button" className="btn btn-secondary grow" disabled={busy} onClick={() => void pdf()}>
              <FileText {...IC} />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* รายงานสำหรับทำ PDF (ขาวดำ วางนอกจอ) */}
      <div style={{ position: 'fixed', left: -10000, top: 0 }} aria-hidden>
        <div ref={pdfRef} className="doc" style={{ width: 720, maxWidth: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <PdfReport r={r} label={rng.label} name={ds.settings.homestay.name} topRoom={topRoom ? ds.rooms.find((x) => x.id === topRoom[0])?.name ?? '' : '–'} topChannel={topChannel ? CHANNEL_LABEL[topChannel[0] as Channel] : '–'} />
        </div>
      </div>
    </div>
  );
}

function PdfReport({ r, label, name, topRoom, topChannel }: { r: Report; label: string; name: string; topRoom: string; topChannel: string }) {
  const rows: Array<[string, string, boolean?]> = [
    ['รายรับจากการเข้าพัก', fmtBaht(r.revenueStay)],
    ['มัดจำที่ไม่คืน (ยกเลิก)', fmtBaht(r.forfeits)],
    ['เงินเรียกคืนจากลูกค้า', fmtBaht(r.recovered)],
    ['รายรับรวม', fmtBaht(r.revenue), true],
    ['ค่าอาหาร', fmtBaht(r.meal)],
    ['ค่าแม่บ้าน', fmtBaht(r.housekeeping)],
    ['ค่ารถรับส่ง', fmtBaht(r.transport)],
    ['ค่าใช้จ่ายจากการแจ้งปัญหา', fmtBaht(r.issueCost)],
    ['ต้นทุนคงที่', fmtBaht(r.fixed)],
    ['ต้นทุนรวม', fmtBaht(r.costTotal), true],
    ['กำไรสุทธิ', fmtBaht(r.profit), true],
    ['ยอดค้างชำระ', `${fmtBaht(r.outstanding)} (${r.outstandingCount} การจอง)`],
    ['ลูกค้าที่เข้าพัก', `${r.arrivalGuests} คน · ${r.arrivals} การจอง`],
    ['อัตราการเข้าพัก', `${r.occupancyPeople.toFixed(1)}% (คน) · ${r.occupancyRooms.toFixed(1)}% (ห้อง)`],
    ['ห้องยอดนิยม / ช่องทางยอดนิยม', `${topRoom} / ${topChannel}`],
  ];
  return (
    <>
      <div className="row-top between">
        <img src="/assets/logo-full.jpg" alt="" width={64} height={76} style={{ objectFit: 'contain', filter: 'grayscale(1)' }} />
        <div className="right">
          <div className="heading" style={{ fontSize: 22 }}>
            รายงานสรุปผลกิจการ
          </div>
          <div className="muted">{label}</div>
          <div className="muted">ออกรายงาน {fmtDate(todayISO())}</div>
        </div>
      </div>
      <div className="b">{name}</div>
      <div>
        {rows.map(([l, v, bold]) => (
          <div key={l} className="row between" style={{ padding: '8px 0', borderBottom: '1px solid #DDE1DC', fontWeight: bold ? 600 : 400 }}>
            <span>{l}</span>
            <span className="num">{v}</span>
          </div>
        ))}
      </div>
      <div className="muted small">รายรับคิดตามคืนที่เข้าพัก · ค่าใช้จ่ายจากปัญหาคิดตามวันที่จ่าย · ต้นทุนคงที่เฉลี่ยตามจำนวนวัน</div>
    </>
  );
}

function delta(cur: number, prev: number, lowerIsBetter = false) {
  if (prev === 0 && cur === 0) return { txt: 'เท่าเดิม', fg: 'var(--color-text-muted)', icon: <Minus {...IC16} /> };
  if (prev === 0) return { txt: 'ใหม่', fg: 'var(--color-text-muted)', icon: <Minus {...IC16} /> };
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const up = pct >= 0;
  const good = lowerIsBetter ? !up : up;
  return { txt: `${up ? '+' : ''}${pct.toFixed(0)}%`, fg: good ? 'var(--ok-text)' : 'var(--danger-text)', icon: up ? <TrendingUp {...IC16} /> : <TrendingDown {...IC16} /> };
}

function deltaPts(cur: number, prev: number) {
  const d = cur - prev;
  if (Math.abs(d) < 0.5) return { txt: 'เท่าเดิม', fg: 'var(--color-text-muted)', icon: <Minus {...IC16} /> };
  return { txt: `${d > 0 ? '+' : ''}${d.toFixed(0)} จุด`, fg: d > 0 ? 'var(--ok-text)' : 'var(--danger-text)', icon: d > 0 ? <TrendingUp {...IC16} /> : <TrendingDown {...IC16} /> };
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 62 + 1},${22 - ((v - min) / span) * 20}`).join(' ');
  return (
    <svg width="64" height="24" viewBox="0 0 64 24" fill="none" style={{ flex: 'none', color: 'var(--color-secondary)' }} aria-hidden>
      <polyline points={pts} stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
