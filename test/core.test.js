import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promptpayPayload, promptpayTarget } from '../src/lib/promptpay.js';
import { diffOps, applyOps } from '../src/lib/ops.js';
import { calcTotal, SET0, occupancy, spotsLeft, add } from '../src/lib/core.js';

test('PromptPay payload: phone number with amount', () => {
  const p = promptpayPayload('081-234-5678', 1700);
  assert.match(p, /^000201010212/);
  assert.ok(p.includes('011300668123456785802TH5303764'));
  assert.ok(p.includes('54071700.00'));
  assert.match(p, /6304[0-9A-F]{4}$/);
});

test('PromptPay payload: static QR has no amount and rejects bad ids', () => {
  assert.match(promptpayPayload('0812345678'), /^000201010211/);
  assert.equal(promptpayTarget('12345'), null);
  assert.equal(promptpayPayload('abc', 100), null);
  assert.equal(promptpayTarget('1234567890123').tag, '02');
});

test('diffOps + applyOps round-trip', () => {
  const a = { id: 'a', v: 1 }, b = { id: 'b', v: 1 };
  const prev = { bookings: [a, b], expenses: [], closures: [], requests: [], reviews: [], audit: [], settings: { x: 1 } };
  const log = { t: 'now', action: 'x' };
  const next = { ...prev, bookings: [{ ...a, v: 2 }, { id: 'c' }], audit: [log], settings: { x: 2 } };
  const ops = diffOps(prev, next);
  assert.deepEqual(ops.map(o => o.c + ':' + o.op).sort(), ['audit:add', 'bookings:del', 'bookings:put', 'bookings:put', 'settings:set']);
  const out = applyOps(prev, ops);
  assert.deepEqual(out.bookings.map(x => x.id).sort(), ['a', 'c']);
  assert.equal(out.bookings.find(x => x.id === 'a').v, 2);
  assert.deepEqual(out.audit, [log]);
  assert.deepEqual(out.settings, { x: 2 });
});

test('price: seasonal rate and group discount', () => {
  const S = JSON.parse(JSON.stringify(SET0));
  const t = calcTotal('2026-10-22', '2026-10-24', 2, S); // one normal night + one festival night
  assert.equal(t.total, 850 * 2 + 990 * 2);
  const g = calcTotal('2026-11-02', '2026-11-03', 15, S);
  assert.equal(g.disc, Math.round(850 * 15 * 0.05));
});

test('availability counts guests per room and closures', () => {
  const S = JSON.parse(JSON.stringify(SET0));
  const d = '2026-11-02';
  const occ = occupancy([{ id: 'k', checkIn: d, checkOut: add(d, 1), adults: 3, children: 0, rooms: { r1: 3 } }]);
  assert.equal(spotsLeft(S, [], occ, d), 21);
  assert.equal(spotsLeft(S, [{ from: d, to: d, room: 'r5' }], occ, d), 13);
  assert.equal(spotsLeft(S, [{ from: d, to: d, room: 'all' }], occ, d), 0);
});
