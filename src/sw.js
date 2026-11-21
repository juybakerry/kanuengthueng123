/* Service Worker ของคะนึงถึง — แคชหน้าแอป/ฟอนต์ไว้ใช้ออฟไลน์ และรับแจ้งเตือน Web Push
   ไฟล์นี้ถูกคัดลอกไปที่ dist/sw.js ตอน build โดยใส่รายการไฟล์และเลขเวอร์ชันให้ (ดู vite.config.ts) */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = `kt-shell-${VERSION}`;
const RUNTIME = 'kt-runtime-v1';
const FILES = 'kt-files-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .catch((e) => console.warn('precache', e)),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('kt-shell-') && k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // รูปสลิป/รูปปัญหา: เก็บไว้ดูตอนออฟไลน์
  if (url.pathname.startsWith('/api/files/')) {
    event.respondWith(
      caches.open(FILES).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
    return;
  }
  if (url.pathname.startsWith('/api/')) return; // ข้อมูลจริงใช้ IndexedDB ของแอปตอนออฟไลน์

  // เปิดหน้า: ลองเน็ตก่อน ถ้าไม่มีสัญญาณใช้หน้าแอปที่เก็บไว้
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 4000);
          const res = await fetch(req, { signal: ctrl.signal });
          clearTimeout(t);
          return res;
        } catch {
          return (await caches.match('/index.html', { ignoreSearch: true })) || (await caches.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }

  // ไฟล์ static: ใช้ของในเครื่องก่อน
  if (/^\/(static|assets|icons)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      (async () => {
        const hit = await caches.match(req, { ignoreSearch: true });
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) (await caches.open(RUNTIME)).put(req, res.clone());
        return res;
      })(),
    );
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'คะนึงถึง', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'คะนึงถึง', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      lang: 'th',
      data: { url: data.url || '/today' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/today', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        if (c.url.startsWith(self.location.origin)) {
          await c.focus();
          if ('navigate' in c) return c.navigate(target);
          return;
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
