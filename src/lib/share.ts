/** ส่งให้ลูกค้าทาง LINE ด้วยการแชร์ของเครื่อง (ฟรี ไม่ใช้โควต้า LINE OA) + QR พร้อมเพย์ + PDF/PNG */
import QRCode from 'qrcode';

export async function qrDataUrl(text: string, size = 320): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: size, color: { dark: '#1F2320', light: '#FFFFFF' } });
}

/** แชร์ข้อความ (มือถือ: เมนูแชร์ของเครื่อง เลือก LINE ได้ · คอม: เปิด LINE share) */
export async function shareText(text: string, url?: string): Promise<'shared' | 'line' | 'copied' | 'cancel'> {
  const full = url ? `${text}\n${url}` : text;
  if (navigator.share) {
    try {
      await navigator.share({ text: full });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancel';
    }
  }
  const w = window.open(`https://line.me/R/share?text=${encodeURIComponent(full)}`, '_blank', 'noopener');
  if (w) return 'line';
  await copyText(full);
  return 'copied';
}

export async function shareFile(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancel'> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancel';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function copyText(t: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(head!)?.[1] ?? 'image/png';
  const bin = atob(b64!);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: mime });
}

/**
 * PDF หน้าเดียวจากรูป JPEG (เขียนเองไม่ใช้ไลบรารี) — ภาษาไทยแสดงถูกต้องเพราะวาดจากหน้าจอจริง
 * ขนาด A4 (595×842 pt) วางรูปพอดีความกว้างพร้อมขอบ
 */
export function jpegToPdf(jpeg: Uint8Array, w: number, h: number): Blob {
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 28;
  const scale = Math.min((pageW - margin * 2) / w, (pageH - margin * 2) / h);
  const dw = w * scale;
  const dh = h * scale;
  const x = (pageW - dw) / 2;
  const y = pageH - margin - dh;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let len = 0;
  const push = (p: Uint8Array | string) => {
    const b = typeof p === 'string' ? enc.encode(p) : p;
    parts.push(b);
    len += b.length;
  };
  const obj = (n: number, body: string | (() => void)) => {
    offsets[n] = len;
    push(`${n} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body();
    push('\nendobj\n');
  };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`);
  obj(4, () => {
    push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    push(jpeg);
    push('\nendstream');
  });
  const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
  obj(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  const xref = len;
  push(`xref\n0 6\n0000000000 65535 f \n${[1, 2, 3, 4, 5].map((n) => `${String(offsets[n]).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
