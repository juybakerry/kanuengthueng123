/** การนำทาง: แท็บหลักเป็น path (/today …) และหน้าซ้อน (รายละเอียด/ฟอร์ม) เก็บใน history เพื่อให้ปุ่มย้อนกลับของมือถือปิดหน้าซ้อนได้ */
import { useSyncExternalStore } from 'react';
import type { ISODate } from '../domain/types';

export type Tab = 'today' | 'calendar' | 'bookings' | 'dashboard' | 'more' | 'issues' | 'customers' | 'settings' | 'requests';
export const TABS: Tab[] = ['today', 'calendar', 'bookings', 'dashboard', 'more', 'issues', 'customers', 'settings', 'requests'];

export interface BookingFormInit {
  editId?: string;
  checkIn?: ISODate;
  checkOut?: ISODate;
  customerId?: string;
  requestId?: string;
  reschedule?: boolean;
}

export type Overlay =
  | { k: 'booking'; id: string }
  | { k: 'form'; init: BookingFormInit }
  | { k: 'doc'; id: string; kind: 'confirm' | 'receipt' }
  | { k: 'issue'; id?: string; bookingId?: string }
  | { k: 'install' };

interface NavState {
  tab: Tab;
  stack: Overlay[];
  params: URLSearchParams;
}

const listeners = new Set<() => void>();
let nav: NavState = read();

function read(): NavState {
  const seg = location.pathname.split('/')[1] as Tab;
  const tab: Tab = TABS.includes(seg) ? seg : 'today';
  const st = (history.state ?? {}) as { stack?: Overlay[] };
  const params = new URLSearchParams(location.search);
  let stack = st.stack ?? [];
  // ลิงก์จากการแจ้งเตือน เช่น /bookings?b=<id>
  const b = params.get('b');
  if (!st.stack && b) stack = [{ k: 'booking', id: b }];
  return { tab, stack, params };
}

function emit() {
  for (const l of listeners) l();
}

window.addEventListener('popstate', () => {
  nav = read();
  emit();
});

export function useNav(): NavState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => nav,
  );
}

export function go(tab: Tab, params = '') {
  history.pushState({ stack: [] }, '', `/${tab}${params}`);
  nav = { tab, stack: [], params: new URLSearchParams(params) };
  window.scrollTo({ top: 0 });
  emit();
}

export function open(o: Overlay) {
  const stack = [...nav.stack, o];
  history.pushState({ stack }, '', `/${nav.tab}${nav.params.toString() && !nav.params.get('b') ? `?${nav.params}` : ''}`);
  nav = { ...nav, stack };
  emit();
}

/** แทนหน้าซ้อนบนสุด (เช่น บันทึกฟอร์มแล้วเปิดรายละเอียดการจอง) */
export function replaceTop(o: Overlay) {
  const stack = [...nav.stack.slice(0, -1), o];
  history.replaceState({ stack }, '', location.href);
  nav = { ...nav, stack };
  emit();
}

export function close() {
  if (nav.stack.length && (history.state as { stack?: Overlay[] } | null)?.stack?.length) history.back();
  else {
    const stack = nav.stack.slice(0, -1);
    history.replaceState({ stack }, '', `/${nav.tab}`);
    nav = { ...nav, stack, params: new URLSearchParams() };
    emit();
  }
}

export function initNav() {
  if (!history.state) history.replaceState({ stack: nav.stack }, '', location.pathname === '/' ? '/today' : location.href);
}
