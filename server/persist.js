// Where the shared data lives.
//   - No DATABASE_URL: a JSON file plus folders on disk (running on your own computer).
//   - DATABASE_URL set: PostgreSQL (Supabase, Neon, …) — needed on free hosts whose disk is wiped on every restart.
// The whole app state is small, so it is stored as one JSON document; photos and daily backups get their own tables.
import fs from 'node:fs';
import path from 'node:path';

export function createPersistence({ dataDir, databaseUrl }) {
  return databaseUrl ? postgres(databaseUrl) : files(dataDir);
}

function files(dir) {
  const db = path.join(dir, 'db.json'), uploads = path.join(dir, 'uploads'), backups = path.join(dir, 'backups');
  fs.mkdirSync(uploads, { recursive: true });
  fs.mkdirSync(backups, { recursive: true });
  const safe = id => (/^[\w.-]+$/.test(id) ? id : null);
  return {
    kind: 'file',
    label: db,
    async load() {
      if (!fs.existsSync(db)) return null;
      try {
        return JSON.parse(fs.readFileSync(db, 'utf8'));
      } catch (e) {
        const bad = db + '.broken-' + Date.now();
        fs.copyFileSync(db, bad);
        console.error(`[data] could not read ${db} (${e.message}); kept a copy at ${bad}`);
        return null;
      }
    },
    async save(data) {
      const tmp = db + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(data));
      fs.renameSync(tmp, db);
    },
    async putFile(id, type, buf) { fs.writeFileSync(path.join(uploads, id), buf); },
    async getFile(id) {
      const f = safe(id) && path.join(uploads, id);
      if (!f || !fs.existsSync(f)) return null;
      const ext = path.extname(id).toLowerCase();
      const type = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic' }[ext] || 'application/octet-stream';
      return { type, buf: fs.readFileSync(f) };
    },
    async backup(day, data, keep) {
      fs.writeFileSync(path.join(backups, `db-${day}.json`), JSON.stringify(data));
      const list = fs.readdirSync(backups).filter(f => f.startsWith('db-')).sort();
      for (const f of list.slice(0, Math.max(0, list.length - keep))) fs.unlinkSync(path.join(backups, f));
    },
    async close() {},
  };
}

function postgres(url) {
  let pool;
  const connect = async () => {
    const { default: pg } = await import('pg');
    const u = new URL(url);
    const local = ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
    u.searchParams.delete('sslmode');
    // Hosted Postgres (Supabase/Neon) requires TLS; their certificates are not in Node's default CA list.
    pool = new pg.Pool({ connectionString: u.toString(), ssl: local ? false : { rejectUnauthorized: false }, max: 3, idleTimeoutMillis: 30000 });
    pool.on('error', e => console.error('[db] idle client error', e.message));
    await pool.query(`
      create table if not exists kt_state (id int primary key, rev int not null, data jsonb not null, updated_at timestamptz not null default now());
      create table if not exists kt_files (id text primary key, type text not null, size int not null, data bytea not null, created_at timestamptz not null default now());
      create table if not exists kt_backups (day date primary key, data jsonb not null, created_at timestamptz not null default now());
    `);
  };
  const ready = connect();
  return {
    kind: 'postgres',
    label: `PostgreSQL ${new URL(url).hostname}`,
    ready,
    async load() {
      await ready;
      const r = await pool.query('select data, rev from kt_state where id = 1');
      return r.rows[0] ? { ...r.rows[0].data, rev: r.rows[0].rev } : null;
    },
    async save(data) {
      await ready;
      await pool.query(
        'insert into kt_state (id, rev, data) values (1, $1, $2) on conflict (id) do update set rev = excluded.rev, data = excluded.data, updated_at = now()',
        [data.rev, JSON.stringify(data)],
      );
    },
    async putFile(id, type, buf) {
      await ready;
      await pool.query('insert into kt_files (id, type, size, data) values ($1, $2, $3, $4)', [id, type, buf.length, buf]);
    },
    async getFile(id) {
      await ready;
      const r = await pool.query('select type, data from kt_files where id = $1', [id]);
      return r.rows[0] ? { type: r.rows[0].type, buf: r.rows[0].data } : null;
    },
    async backup(day, data, keep) {
      await ready;
      await pool.query('insert into kt_backups (day, data) values ($1, $2) on conflict (day) do update set data = excluded.data, created_at = now()', [day, JSON.stringify(data)]);
      await pool.query('delete from kt_backups where day not in (select day from kt_backups order by day desc limit $1)', [keep]);
    },
    async close() { if (pool) await pool.end(); },
  };
}
