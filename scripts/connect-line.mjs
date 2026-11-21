// เชื่อม LINE OA กับแอปจริง: node scripts/connect-line.mjs
// อ่านคีย์จาก .secrets/line.txt (gitignore): บรรทัดแรก = Channel secret, บรรทัดที่สอง = Channel access token (long-lived)
// บรรทัดที่ขึ้นต้นด้วย # ไม่นับ · สคริปต์ตั้ง wrangler secret, ตั้ง Webhook URL, เปิด Use webhook และทดสอบให้
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const APP = 'https://kanuengthueng.juybakerry.workers.dev';
const root = new URL('..', import.meta.url);
const p = (rel) => new URL(rel, root).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const lines = readFileSync(p('.secrets/line.txt'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'))
  .map((l) => l.replace(/^[^:=]*[:=]\s*/, (m) => (/secret|token/i.test(m) ? '' : m)));
const [secret, token] = lines;
if (!secret || !token || secret.length !== 32 || token.length < 100) {
  console.error('ต้องมี Channel secret (32 ตัว) บรรทัดแรก และ Channel access token (ยาวมาก) บรรทัดที่สอง ใน .secrets/line.txt');
  process.exit(1);
}
const api = async (method, path, body) => {
  const r = await fetch(`https://api.line.me${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  return { ok: r.ok, status: r.status, data: t ? JSON.parse(t) : null };
};

const info = await api('GET', '/v2/bot/info');
if (!info.ok) {
  console.error('Channel access token ใช้ไม่ได้', info.status, JSON.stringify(info.data));
  process.exit(1);
}
console.log(`OA: ${info.data.displayName} (${info.data.basicId})`);

const wrangler = p('node_modules/wrangler/bin/wrangler.js');
for (const [name, value] of [['LINE_CHANNEL_SECRET', secret], ['LINE_CHANNEL_ACCESS_TOKEN', token]]) {
  execFileSync(process.execPath, [wrangler, 'secret', 'put', name], { input: value, stdio: ['pipe', 'inherit', 'inherit'], cwd: p('.'), env: { ...process.env, WRANGLER_SEND_METRICS: 'false' } });
}
// รอให้ secret ใหม่มีผล
await new Promise((r) => setTimeout(r, 8000));
const health = await (await fetch(`${APP}/api/health`)).json();
console.log('app line configured:', health.line);

const set = await api('PUT', '/v2/bot/channel/webhook/endpoint', { endpoint: `${APP}/api/line/webhook` });
console.log('set webhook:', set.status);
const test = await api('POST', '/v2/bot/channel/webhook/test', { endpoint: `${APP}/api/line/webhook` });
console.log('webhook test:', JSON.stringify(test.data));
const ep = await api('GET', '/v2/bot/channel/webhook/endpoint');
console.log('webhook active:', ep.data?.active, ep.data?.endpoint);
const quota = await api('GET', '/v2/bot/message/quota');
console.log('monthly quota:', JSON.stringify(quota.data));
