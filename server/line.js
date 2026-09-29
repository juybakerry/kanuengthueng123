// LINE Messaging API (LINE Official Account): push notifications to the owner and a webhook
// that lets the owner register a chat to receive them. Needs LINE_CHANNEL_ACCESS_TOKEN (and
// LINE_CHANNEL_SECRET for the webhook) in the environment; without them messages are only logged.
import crypto from 'node:crypto';

const token = () => process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
const secret = () => process.env.LINE_CHANNEL_SECRET || '';

export const lineReady = () => !!token();
export const webhookReady = () => !!(token() && secret());

// Chats that always receive notifications, from LINE_TO (comma separated user/group ids).
export const envTargets = () => (process.env.LINE_TO || '').split(',').map(s => s.trim()).filter(Boolean);

async function call(path, body) {
  try {
    const r = await fetch('https://api.line.me/v2/bot/message/' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() },
      body: JSON.stringify(body),
    });
    if (r.ok) return { ok: true };
    const error = await r.text();
    console.error(`[LINE] ${path} failed`, r.status, error);
    return { ok: false, reason: 'http-' + r.status, error };
  } catch (e) {
    console.error(`[LINE] ${path} failed`, e.message);
    return { ok: false, reason: 'network', error: e.message };
  }
}

const msg = text => [{ type: 'text', text: String(text).slice(0, 4900) }];

// Push to every target; each recipient counts toward the monthly free message quota.
export async function pushLine(targets, text) {
  if (!lineReady() || !targets.length) {
    console.log(`[LINE: ${lineReady() ? 'no recipients registered' : 'not configured'}]\n${text}`);
    return { ok: false, reason: lineReady() ? 'no-targets' : 'not-configured' };
  }
  const results = await Promise.all(targets.map(to => call('push', { to, messages: msg(text) })));
  const failed = results.filter(r => !r.ok);
  return failed.length ? { ok: false, reason: failed[0].reason, error: failed[0].error, sent: results.length - failed.length } : { ok: true, sent: results.length };
}

// Replies are free (they don't use the quota) but must be sent within a minute of the user's message.
export const replyLine = (replyToken, text) => call('reply', { replyToken, messages: msg(text) });

export function validSignature(raw, signature) {
  if (!secret() || !signature) return false;
  const expected = crypto.createHmac('sha256', secret()).update(raw).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
