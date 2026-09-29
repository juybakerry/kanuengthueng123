// Talking to the server. The staff PIN (if the server has one) is kept in this browser.

const PIN_KEY = 'kt-pin';

export function getPin() {
  try { return localStorage.getItem(PIN_KEY) || ''; } catch { return ''; }
}
export function setPin(p) {
  try { localStorage.setItem(PIN_KEY, p); } catch { /* storage blocked */ }
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export async function api(path, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const h = { ...headers };
  const pin = getPin();
  if (pin) h['x-admin-pin'] = pin;
  let b = body;
  if (body !== undefined && !raw) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  let r;
  try {
    r = await fetch(path, { method, headers: h, body: b });
  } catch {
    throw new ApiError(0, 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, data.error || 'HTTP ' + r.status);
  return data;
}

// URLs that the browser loads directly (images, event stream) can't send headers, so the PIN goes in the query.
export function withPin(url) {
  const p = getPin();
  return p ? url + (url.includes('?') ? '&' : '?') + 'pin=' + encodeURIComponent(p) : url;
}

export function uploadFile(file) {
  return api('/api/upload?name=' + encodeURIComponent(file.name), {
    method: 'POST', body: file, raw: true, headers: { 'Content-Type': file.type || 'application/octet-stream' },
  });
}

// Phone photos are several MB; shrink them to ~1600px JPEG before upload so the free database lasts.
// Images the browser can't decode (e.g. HEIC on Chrome) are sent as they are.
async function shrink(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

// Upload several images; files that fail (e.g. offline) are kept by name only.
export async function uploadAll(fileList) {
  const out = [], failed = [];
  for (const f of [...fileList]) {
    try { out.push(await uploadFile(await shrink(f))); } catch { out.push({ name: f.name }); failed.push(f.name); }
  }
  return { files: out, failed };
}
