/** เรียก API ของเซิร์ฟเวอร์ (cookie session) */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'ERROR',
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; raw?: BodyInit; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 20000);
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body !== undefined || opts.raw ? 'POST' : 'GET'),
      credentials: 'same-origin',
      headers: opts.raw ? opts.headers : { 'Content-Type': 'application/json', ...opts.headers },
      body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, 'ไม่มีสัญญาณอินเทอร์เน็ต', 'OFFLINE');
  } finally {
    clearTimeout(t);
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const d = data as { error?: string; code?: string } | null;
    throw new ApiError(res.status, d?.error ?? (res.status >= 500 ? 'เซิร์ฟเวอร์ขัดข้อง ลองใหม่อีกครั้ง' : 'ทำรายการไม่สำเร็จ'), d?.code ?? 'ERROR');
  }
  return data as T;
}

/** ส่งข้อผิดพลาดของแอปไปเก็บที่เซิร์ฟเวอร์ (จำกัดจำนวน ไม่ใช้บริการเสียเงิน) */
export function reportError(message: string, detail = ''): void {
  try {
    void fetch('/api/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, detail, url: location.pathname }) });
  } catch {
    /* ignore */
  }
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (iPad) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'มือถือ Android' : 'แท็บเล็ต Android';
  if (/Windows/.test(ua)) return 'คอมพิวเตอร์ Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'อุปกรณ์';
}
