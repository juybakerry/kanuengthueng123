// The shared data in memory: applying ops, saving through the persistence layer, and telling open browsers about changes.
import { applyOps, COLLS, randomToken } from '../src/lib/ops.js';
import { withDefaults } from '../src/lib/core.js';
import { seedData } from '../src/lib/seed.js';

export function emptyData() {
  const d = seedData();
  return { ...d, bookings: [], expenses: [], closures: [], audit: [], requests: [], reviews: [] };
}

// Give old/seeded records the fields newer code relies on.
function normalize(d) {
  const o = { v: 1, rev: d.rev || 1, meta: d.meta || {}, audit: d.audit || [], settings: withDefaults(d.settings) };
  for (const c of COLLS) o[c] = Array.isArray(d[c]) ? d[c] : [];
  o.bookings = o.bookings.map(b => (b.token && b.uid ? b : { ...b, token: b.token || randomToken(), uid: b.uid || randomToken(8) }));
  return o;
}

export async function createStore(persist) {
  const loaded = await persist.load();
  let data = normalize(loaded || seedData());

  // Saves run one after another; a failed save is retried with whatever the data is by then.
  let timer = null, chain = Promise.resolve();
  const write = () => {
    const snapshot = data;
    chain = chain.then(() => persist.save(snapshot)).catch(e => {
      console.error('[data] save failed, retrying in 5s:', e.message);
      clearTimeout(timer);
      timer = setTimeout(() => { timer = null; write(); }, 5000);
    });
    return chain;
  };
  const save = () => { if (!timer) timer = setTimeout(() => { timer = null; write(); }, 150); };
  const saveNow = () => { clearTimeout(timer); timer = null; return write(); };
  if (!loaded) await saveNow();

  const clients = new Set();
  const listeners = new Set();
  const broadcast = () => {
    const msg = `event: rev\ndata: ${JSON.stringify({ rev: data.rev })}\n\n`;
    for (const res of clients) res.write(msg);
  };

  function commit(next) {
    const prevRev = data.rev;
    data = { ...next, rev: prevRev + 1 };
    save();
    broadcast();
    return { prevRev, rev: data.rev };
  }

  return {
    get: () => data,
    label: persist.label,
    saveNow,
    onChange: fn => listeners.add(fn),

    // Apply browser ops. A new booking whose id was already taken by a different booking gets the next free id.
    apply(ops) {
      const before = data;
      const fixed = [];
      const clean = ops.map(op => {
        if (op.c !== 'bookings' || op.op !== 'put') return op;
        const rec = { ...op.rec };
        const cur = before.bookings.find(b => b.id === rec.id);
        if (!rec.uid) rec.uid = (cur && cur.uid) || randomToken(8);
        if (!rec.token) rec.token = (cur && cur.token) || randomToken();
        if (cur && cur.uid && cur.uid !== rec.uid && !before.bookings.some(b => b.uid === rec.uid)) {
          const n = Math.max(0, ...before.bookings.map(b => +String(b.id).slice(3) || 0)) + 1;
          const id = 'KT-' + String(n).padStart(4, '0');
          fixed.push({ from: rec.id, to: id });
          rec.id = id;
        }
        return { ...op, rec };
      });
      const next = applyOps(before, clean);
      const r = commit(next);
      for (const fn of listeners) fn(before, data, clean);
      return { ...r, fixed };
    },

    replace(next) {
      const before = data;
      const r = commit(normalize({ ...next, rev: data.rev, meta: data.meta }));
      for (const fn of listeners) fn(before, data, []);
      return r;
    },

    update(fn) { return commit(fn(data)); },

    subscribe(res) {
      clients.add(res);
      res.on('close', () => clients.delete(res));
    },
    ping() { for (const res of clients) res.write(': ping\n\n'); },
  };
}
