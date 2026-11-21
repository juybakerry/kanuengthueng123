import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { jpegToPdf } from '../src/lib/share';

describe('PDF จากรูป JPEG', () => {
  it('สร้าง PDF A4 ที่มีโครงสร้างถูกต้อง', async () => {
    const jpg = new Uint8Array(readFileSync(new URL('../public/assets/mood-mist.jpg', import.meta.url)));
    // ขนาดรูป: อ่านจาก SOF0 ของ JPEG
    let w = 0;
    let h = 0;
    for (let i = 2; i < jpg.length; ) {
      const marker = jpg[i + 1]!;
      const len = (jpg[i + 2]! << 8) | jpg[i + 3]!;
      if (marker >= 0xc0 && marker <= 0xc2) {
        h = (jpg[i + 5]! << 8) | jpg[i + 6]!;
        w = (jpg[i + 7]! << 8) | jpg[i + 8]!;
        break;
      }
      i += 2 + len;
    }
    expect(w).toBeGreaterThan(0);
    const pdf = new Uint8Array(await jpegToPdf(jpg, w, h).arrayBuffer());
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
    const xref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(xref, xref + 4)).toBe('xref');
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, pdf);
  });
});
