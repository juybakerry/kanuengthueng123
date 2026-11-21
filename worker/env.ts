export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_URL: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET?: string;
  /** "1" = เครื่องพัฒนา: cookie ไม่บังคับ Secure, มี endpoint ทดสอบ */
  DEV_MODE?: string;
  /** โทเคนสำหรับสคริปต์ดูแลระบบ (สร้างผู้ใช้ครั้งแรก, สำรองข้อมูล) */
  ADMIN_TOKEN?: string;
}
