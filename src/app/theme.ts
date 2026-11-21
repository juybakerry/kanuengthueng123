/** ธีม: หมอกเช้า (สว่าง) / กองไฟ (มืด) / อัตโนมัติ (ตามเครื่อง หรือ 06:00–18:00 หมอกเช้า) */
import { useEffect, useState } from 'react';

export type ThemePref = 'mist' | 'campfire' | 'auto';

const KEY = 'kt-theme';

export function getPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'mist' || v === 'campfire' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function resolve(pref: ThemePref): 'mist' | 'campfire' {
  if (pref !== 'auto') return pref;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'campfire';
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? 'mist' : 'campfire';
}

export function applyTheme(pref = getPref()) {
  const t = resolve(pref);
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'campfire' ? '#161311' : '#2F4A3D');
  return t;
}

const subs = new Set<() => void>();
export function setPref(p: ThemePref) {
  try {
    localStorage.setItem(KEY, p);
  } catch {
    /* ignore */
  }
  applyTheme(p);
  subs.forEach((f) => f());
}

export function useTheme(): { pref: ThemePref; theme: 'mist' | 'campfire'; toggle: () => void; set: (p: ThemePref) => void } {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onMq = () => {
      if (getPref() === 'auto') {
        applyTheme();
        f();
      }
    };
    mq?.addEventListener?.('change', onMq);
    const timer = setInterval(onMq, 5 * 60_000);
    return () => {
      subs.delete(f);
      mq?.removeEventListener?.('change', onMq);
      clearInterval(timer);
    };
  }, []);
  const pref = getPref();
  const theme = resolve(pref);
  return { pref, theme, toggle: () => setPref(theme === 'mist' ? 'campfire' : 'mist'), set: setPref };
}
