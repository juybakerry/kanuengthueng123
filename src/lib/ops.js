// Change operations shared by the browser and the server.
// The browser diffs its state into ops and sends them; the server applies them
// to the shared copy, and browsers re-apply any not-yet-sent ops on top of fresh server data.

export const COLLS = ['bookings', 'expenses', 'closures', 'requests', 'reviews'];
export const DATA_KEYS = [...COLLS, 'audit', 'settings'];
const AUDIT_MAX = 500;

export function pickData(s) {
  const o = {};
  for (const k of DATA_KEYS) o[k] = s[k];
  return o;
}

// Ops needed to turn `prev` into `next`. Relies on immutable updates: an unchanged record keeps its object identity.
export function diffOps(prev, next) {
  const ops = [];
  for (const c of COLLS) {
    const a = prev[c] || [], b = next[c] || [];
    if (a === b) continue;
    const before = new Map(a.map(x => [x.id, x]));
    const ids = new Set();
    for (const x of b) {
      ids.add(x.id);
      if (before.get(x.id) !== x) ops.push({ c, op: 'put', rec: x });
    }
    for (const x of a) if (!ids.has(x.id)) ops.push({ c, op: 'del', id: x.id });
  }
  if (prev.audit !== next.audit) {
    const seen = new Set(prev.audit || []);
    const added = (next.audit || []).filter(x => !seen.has(x));
    for (let i = added.length - 1; i >= 0; i--) ops.push({ c: 'audit', op: 'add', rec: added[i] });
  }
  if (prev.settings !== next.settings) ops.push({ c: 'settings', op: 'set', value: next.settings });
  return ops;
}

export function applyOps(data, ops) {
  const o = { ...data };
  for (const op of ops) {
    if (op.c === 'settings') {
      if (op.op === 'set' && op.value && typeof op.value === 'object') o.settings = op.value;
    } else if (op.c === 'audit') {
      if (op.op === 'add' && op.rec) o.audit = [op.rec, ...(o.audit || [])].slice(0, AUDIT_MAX);
    } else if (COLLS.includes(op.c)) {
      const arr = o[op.c] || [];
      if (op.op === 'put' && op.rec && op.rec.id != null) {
        const i = arr.findIndex(x => x.id === op.rec.id);
        o[op.c] = i < 0 ? [...arr, op.rec] : arr.map((x, j) => (j === i ? op.rec : x));
      } else if (op.op === 'del') {
        o[op.c] = arr.filter(x => x.id !== op.id);
      }
    }
  }
  return o;
}

export function randomToken(n = 16) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, b => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
}
