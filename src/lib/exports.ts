/** ส่งออก Excel: รายงานตามช่วงเวลา (FR-13) และข้อมูลทั้งหมด (สำรองเอง) */
import { buildXlsx, baht, type Sheet } from './xlsx';
import { downloadBlob } from './share';
import { report, bookingNightRevenue } from '../domain/costs';
import { fmtDate } from '../domain/dates';
import { dueOf, guestsOf, paidOf, payStatusOf } from '../domain/pricing';
import { BOOKING_STATUS_LABEL, CHANNEL_LABEL, ISSUE_STATUS_LABEL, METHOD_LABEL, PAYMENT_KIND_LABEL, PAY_STATUS_LABEL } from '../domain/defaults';
import type { Dataset } from '../domain/types';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function bookingSheet(ds: Dataset, filter: (checkIn: string) => boolean): Sheet {
  const rooms = new Map(ds.rooms.map((r) => [r.id, r.name]));
  const rows = ds.bookings
    .filter((b) => filter(b.checkIn))
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))
    .map((b) => {
      const paid = paidOf(b.id, ds.payments);
      return [
        b.code,
        b.name,
        b.phone,
        b.lineId,
        fmtDate(b.checkIn),
        fmtDate(b.checkOut),
        b.nightly.length,
        b.adults,
        b.children,
        b.rooms.map((r) => `${rooms.get(r.roomId) ?? ''} (${r.guests}${r.whole ? ' ทั้งห้อง' : ''})`).join(', '),
        CHANNEL_LABEL[b.channel],
        BOOKING_STATUS_LABEL[b.status],
        PAY_STATUS_LABEL[payStatusOf(b.total, paid)],
        baht(b.total),
        baht(paid),
        baht(dueOf(b.total, paid)),
        b.usesTransport ? `${b.pickupTime} ${b.pickupPoint}`.trim() || 'ใช้' : '',
        b.allergies,
        b.notes,
      ];
    });
  return {
    name: 'การจอง',
    rows: [['เลขที่', 'ชื่อลูกค้า', 'เบอร์โทร', 'LINE', 'เข้าพัก', 'ออก', 'คืน', 'ผู้ใหญ่', 'เด็ก', 'ห้อง', 'ช่องทาง', 'สถานะ', 'การชำระ', 'ยอดรวม', 'ชำระแล้ว', 'คงเหลือ', 'รถรับส่ง', 'อาหารที่แพ้', 'หมายเหตุ'], ...rows],
    widths: [14, 24, 14, 14, 12, 12, 6, 8, 6, 26, 12, 12, 12, 12, 12, 12, 20, 20, 30],
  };
}

export function exportReport(ds: Dataset, from: string, to: string, label: string) {
  const r = report(from, to, { ...ds, housekeepingCost: ds.settings.housekeepingCost });
  const inRange = (d: string) => from <= d && d <= to;
  const summary: Sheet = {
    name: 'สรุป',
    rows: [
      ['รายการ', 'จำนวน'],
      [{ v: `${ds.settings.homestay.name} · ${label}`, bold: true }, null],
      ['ช่วงวันที่', `${fmtDate(from)} – ${fmtDate(to)}`],
      ['รายรับจากการเข้าพัก (ตามคืนที่พัก)', baht(r.revenueStay)],
      ['มัดจำที่ไม่คืน (ยกเลิก)', baht(r.forfeits)],
      ['เงินเรียกคืนจากลูกค้า', baht(r.recovered)],
      [{ v: 'รายรับรวม', bold: true }, baht(r.revenue)],
      ['ค่าอาหาร', baht(r.meal)],
      ['ค่าแม่บ้าน', baht(r.housekeeping)],
      ['ค่ารถรับส่ง', baht(r.transport)],
      ['ค่าใช้จ่ายจากการแจ้งปัญหา', baht(r.issueCost)],
      ['ต้นทุนคงที่', baht(r.fixed)],
      [{ v: 'ต้นทุนรวม', bold: true }, baht(r.costTotal)],
      [{ v: 'กำไรสุทธิ', bold: true }, baht(r.profit)],
      ['ยอดค้างชำระ (การจองที่เข้าพักในช่วงนี้)', baht(r.outstanding)],
      ['จำนวนการจอง (เช็คอินในช่วงนี้)', r.arrivals],
      ['จำนวนลูกค้าที่เข้าพัก', r.arrivalGuests],
      ['คืน-คนที่ขายได้', r.guestNights],
      ['อัตราการเข้าพัก (คน) %', Math.round(r.occupancyPeople * 10) / 10],
      ['อัตราการเข้าพัก (ห้อง) %', Math.round(r.occupancyRooms * 10) / 10],
    ],
    widths: [42, 22],
  };
  const daily: Sheet = { name: 'รายวัน', rows: [['วันที่', 'รายรับ'], ...[...r.revenueByDay].map(([d, v]) => [fmtDate(d), baht(v)])], widths: [16, 14] };
  const pays: Sheet = {
    name: 'รับเงิน',
    rows: [
      ['วันที่', 'การจอง', 'ประเภท', 'ช่องทาง', 'จำนวน', 'ผู้รับ', 'หมายเหตุ'],
      ...ds.payments
        .filter((p) => inRange(p.paidOn))
        .sort((a, b) => a.paidOn.localeCompare(b.paidOn))
        .map((p) => {
          const b = ds.bookings.find((x) => x.id === p.bookingId);
          return [fmtDate(p.paidOn), `${b?.code ?? ''} ${b?.name ?? ''}`.trim(), PAYMENT_KIND_LABEL[p.kind], METHOD_LABEL[p.method], baht(p.kind === 'refund' ? -p.amount : p.amount), p.recordedBy, p.note];
        }),
    ],
    widths: [12, 30, 12, 12, 12, 16, 24],
  };
  const issues: Sheet = {
    name: 'ค่าใช้จ่าย',
    rows: [
      ['วันที่จ่าย', 'หัวข้อ', 'หมวด', 'ห้อง', 'จำนวน', 'เรียกคืน', 'สถานะ', 'ผู้แจ้ง'],
      ...ds.issues
        .filter((i) => inRange(i.paidOn ?? i.occurredOn) || (i.recover > 0 && inRange(i.recoverOn ?? i.occurredOn)))
        .map((i) => [fmtDate(i.paidOn ?? i.occurredOn), i.title, ds.categories.find((c) => c.id === i.categoryId)?.name ?? '', ds.rooms.find((r) => r.id === i.roomId)?.name ?? '', baht(i.amount), baht(i.recover), ISSUE_STATUS_LABEL[i.status], i.reportedBy]),
    ],
    widths: [12, 30, 16, 10, 12, 12, 10, 14],
  };
  const nights: Sheet = {
    name: 'รายรับตามคืน',
    rows: [
      ['คืนวันที่', 'การจอง', 'คน', 'รายรับ'],
      ...ds.bookings
        .filter((b) => !b.deletedAt && ['confirmed', 'checked_in', 'checked_out', 'pending'].includes(b.status))
        .flatMap((b) => bookingNightRevenue(b).filter((n) => inRange(n.date)).map((n) => [fmtDate(n.date), `${b.code} ${b.name}`, guestsOf(b), baht(n.amount)])),
    ],
    widths: [14, 30, 6, 12],
  };
  const xlsx = buildXlsx([summary, daily, bookingSheet(ds, (d) => inRange(d)), nights, pays, issues]);
  downloadBlob(new Blob([xlsx as BlobPart], { type: XLSX }), `รายงาน-${from}-ถึง-${to}.xlsx`);
}

export function exportAllExcel(ds: Dataset) {
  const sheets: Sheet[] = [
    bookingSheet(ds, () => true),
    {
      name: 'ลูกค้า',
      rows: [['ชื่อ', 'เบอร์โทร', 'LINE', 'อาหารที่แพ้', 'หมายเหตุ', 'จำนวนครั้งที่พัก'], ...ds.customers.map((c) => [c.name, c.phone, c.lineId, c.allergies, c.notes, ds.bookings.filter((b) => b.customerId === c.id && b.status !== 'cancelled').length])],
      widths: [24, 14, 14, 20, 30, 10],
    },
    {
      name: 'รับเงิน',
      rows: [['วันที่', 'การจอง', 'ประเภท', 'ช่องทาง', 'จำนวน', 'ผู้รับ'], ...ds.payments.map((p) => [fmtDate(p.paidOn), ds.bookings.find((b) => b.id === p.bookingId)?.code ?? '', PAYMENT_KIND_LABEL[p.kind], METHOD_LABEL[p.method], baht(p.kind === 'refund' ? -p.amount : p.amount), p.recordedBy])],
      widths: [12, 16, 12, 12, 12, 14],
    },
    {
      name: 'ค่าใช้จ่าย',
      rows: [['วันที่', 'หัวข้อ', 'จำนวน', 'เรียกคืน', 'สถานะ'], ...ds.issues.map((i) => [fmtDate(i.paidOn ?? i.occurredOn), i.title, baht(i.amount), baht(i.recover), ISSUE_STATUS_LABEL[i.status]])],
      widths: [12, 30, 12, 12, 10],
    },
    {
      name: 'แบบประเมิน',
      rows: [['วันที่', 'การจอง', 'คะแนน', 'แท็ก', 'ความเห็น'], ...ds.surveys.map((s) => [s.submittedAt.slice(0, 10), ds.bookings.find((b) => b.id === s.bookingId)?.name ?? '', s.score, s.tags.join(', '), s.comment])],
      widths: [12, 24, 8, 30, 40],
    },
  ];
  downloadBlob(new Blob([buildXlsx(sheets) as BlobPart], { type: XLSX }), `คะนึงถึง-ข้อมูลทั้งหมด-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
