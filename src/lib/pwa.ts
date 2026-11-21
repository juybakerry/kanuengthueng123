/** PWA: service worker, แถบ "มีเวอร์ชันใหม่", ปุ่มติดตั้ง (Android), แจ้งเตือน Web Push (iOS 16.4+ ต้องติดตั้งก่อน) */
import { api } from './api';

let waiting: ServiceWorker | null = null;
const updSubs = new Set<() => void>();
let deferredPrompt: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
const installSubs = new Set<() => void>();

export function registerSW() {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const track = (w: ServiceWorker | null) => {
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            waiting = w;
            updSubs.forEach((f) => f());
          }
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) {
        waiting = reg.waiting;
        updSubs.forEach((f) => f());
      }
      track(reg.installing);
      reg.addEventListener('updatefound', () => track(reg.installing));
      // ตรวจเวอร์ชันใหม่ทุก 30 นาที และเมื่อกลับมาเปิดแอป
      setInterval(() => void reg.update(), 30 * 60_000);
      document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void reg.update());
      void navigator.storage?.persist?.();
    } catch (e) {
      console.warn('sw', e);
    }
  });
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as typeof deferredPrompt;
    installSubs.forEach((f) => f());
  });
}

/** แจ้งเมื่อมีเวอร์ชันใหม่ (ไม่รีโหลดเองระหว่างกรอกฟอร์ม — ผู้ใช้แตะแถบเอง) */
export function updateReady(fn: () => void): () => void {
  if (waiting) fn();
  updSubs.add(fn);
  return () => {
    updSubs.delete(fn);
  };
}

export function applyUpdate() {
  waiting?.postMessage({ type: 'SKIP_WAITING' });
  if (!waiting) location.reload();
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function platform(): 'ios' | 'android' | 'desktop' {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

export const canPromptInstall = () => !!deferredPrompt;
export function onInstallable(fn: () => void): () => void {
  installSubs.add(fn);
  return () => {
    installSubs.delete(fn);
  };
}
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  await deferredPrompt.prompt();
  const r = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return r.outcome === 'accepted';
}

/* ---------- Web Push ---------- */

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function pushState(): Promise<'unsupported' | 'need-install' | 'denied' | 'on' | 'off'> {
  if (!pushSupported()) return platform() === 'ios' && !isStandalone() ? 'need-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? 'on' : 'off';
}

function b64ToBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

/** ต้องเรียกจากการกดปุ่มของผู้ใช้ (iOS บังคับ) */
export async function enablePush(vapidPublicKey: string, device: string): Promise<void> {
  if (!vapidPublicKey) throw new Error('เซิร์ฟเวอร์ยังไม่ได้ตั้งคีย์แจ้งเตือน');
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('ไม่ได้อนุญาตการแจ้งเตือน เปิดได้ที่การตั้งค่าของเครื่อง');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidPublicKey) as BufferSource }));
  await api('/api/push/subscribe', { body: { ...sub.toJSON(), device } });
}

export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await api('/api/push/unsubscribe', { body: { endpoint: sub.endpoint } }).catch(() => {});
    await sub.unsubscribe();
  }
}
