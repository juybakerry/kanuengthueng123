/** งานตั้งเวลา (cron ทุกชั่วโมง) — สรุป 09:00 / 18:00, สำรองข้อมูล 03:00, เก็บกวาด */
import type { Env } from './env';
import { nowIso } from './http';
import { getSettings, loadDataset } from './records';
import { morningDigest, tomorrowDigest, digestText } from './digest';
import { notifyAll } from './push';
import { linePush } from './line';
import { runBackup } from './backup';
import { bangkokHour, todayISO } from '../src/domain/dates';

/** ส่งครั้งเดียวต่อวันต่อประเภท (บันทึกลง notification_log กันส่งซ้ำ) */
async function once(env: Env, key: string, kind: string, fn: () => Promise<string>): Promise<void> {
  const claimed = await env.DB.prepare('INSERT OR IGNORE INTO notification_log (key, kind, status, sent_at) VALUES (?, ?, ?, ?)').bind(key, kind, 'running', nowIso()).run();
  if (!claimed.meta.changes) return;
  try {
    const status = await fn();
    await env.DB.prepare('UPDATE notification_log SET status = ? WHERE key = ?').bind(status, key).run();
  } catch (e) {
    await env.DB.prepare('UPDATE notification_log SET status = ? WHERE key = ?').bind(`error: ${String(e).slice(0, 200)}`, key).run();
    throw e;
  }
}

export async function runCron(env: Env, now = new Date()): Promise<void> {
  const hour = bangkokHour(now);
  const today = todayISO(now);
  const st = await getSettings(env.DB);
  const jobs: Promise<unknown>[] = [];

  if (hour === st.notifyMorningHour) {
    jobs.push(
      once(env, `morning:${today}`, 'morning', async () => {
        const d = morningDigest(await loadDataset(env.DB), today);
        if (!d) return 'nothing';
        const r = await notifyAll(env, [{ title: d.title, body: d.lines.slice(0, 6).join('\n'), url: '/today', tag: 'morning' }]);
        return `push ${r.sent}`;
      }),
    );
  }
  if (hour === st.notifyEveningHour) {
    jobs.push(
      once(env, `evening:${today}`, 'evening', async () => {
        const d = tomorrowDigest(await loadDataset(env.DB), today);
        if (!d) return 'nothing';
        const r = await notifyAll(env, [{ title: d.title, body: d.lines.slice(0, 6).join('\n'), url: '/today?day=tomorrow', tag: 'evening' }]);
        const l = st.lineDigest ? await linePush(env, digestText(d)) : 0;
        return `push ${r.sent} line ${l}`;
      }),
    );
  }
  if (hour === 3) {
    jobs.push(once(env, `backup:${today}`, 'backup', async () => JSON.stringify(await runBackup(env))));
    jobs.push(
      env.DB.batch([
        env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(nowIso()),
        env.DB.prepare('DELETE FROM ops WHERE at < ?').bind(new Date(Date.now() - 30 * 86400000).toISOString()),
        env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(Math.floor(Date.now() / 1000) - 86400),
        env.DB.prepare('DELETE FROM notification_log WHERE sent_at < ?').bind(new Date(Date.now() - 90 * 86400000).toISOString()),
        env.DB.prepare('DELETE FROM client_errors WHERE id NOT IN (SELECT id FROM client_errors ORDER BY id DESC LIMIT 500)'),
      ]),
    );
  }
  const res = await Promise.allSettled(jobs);
  for (const r of res) if (r.status === 'rejected') console.error('cron job failed', r.reason);
}
