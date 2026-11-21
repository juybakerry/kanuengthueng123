// สำรองฐานข้อมูลจริงลงเครื่อง (ทำเพิ่มจากการสำรองอัตโนมัติในระบบ): node scripts/backup.mjs
// ใช้ wrangler d1 export → backups/kanuengthueng-YYYY-MM-DD.sql (เก็บ 12 ไฟล์ล่าสุด, gitignore แล้ว)
// กู้คืน: wrangler d1 execute kanuengthueng --remote --file backups/<ไฟล์>.sql (ฐานข้อมูลต้องว่างก่อน)
// หรือย้อนเวลาได้ 7 วันล่าสุด (แผนฟรี) ด้วย: wrangler d1 time-travel restore kanuengthueng --timestamp <เวลา>
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../backups/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
mkdirSync(dir, { recursive: true });
const file = join(dir, `kanuengthueng-${new Date().toISOString().slice(0, 10)}.sql`);
const wrangler = new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
execFileSync(process.execPath, [wrangler, 'd1', 'export', 'kanuengthueng', '--remote', '--output', file], { stdio: 'inherit', env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
console.log(`saved ${file} (${Math.round(statSync(file).size / 1024)} KB)`);
const all = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
for (const f of all.slice(0, Math.max(0, all.length - 12))) rmSync(join(dir, f));
