/** Thai QR (PromptPay) ตามมาตรฐาน EMVCo ที่ธนาคารไทยใช้ ไม่ต้องใช้ API ธนาคาร */
import type { Satang } from './types';

const f = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;

function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** รับเบอร์มือถือ (0812345678), เลขบัตร/ภาษี 13 หลัก หรือ e-wallet 15 หลัก */
export function promptpayTarget(id: string): { tag: string; value: string } | null {
  const d = String(id || '').replace(/\D/g, '');
  if (d.length === 10 && d[0] === '0') return { tag: '01', value: ('0000000000000' + '66' + d.slice(1)).slice(-13) };
  if (d.length === 13) return { tag: '02', value: d };
  if (d.length === 15) return { tag: '03', value: d };
  return null;
}

export function promptpayPayload(id: string, amount: Satang): string | null {
  const t = promptpayTarget(id);
  if (!t) return null;
  const amt = amount > 0 ? (amount / 100).toFixed(2) : '';
  let p = f('00', '01') + f('01', amt ? '12' : '11') + f('29', f('00', 'A000000677010111') + f(t.tag, t.value)) + f('58', 'TH') + f('53', '764');
  if (amt) p += f('54', amt);
  p += '6304';
  return p + crc16(p);
}
