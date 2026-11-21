-- คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์ — ฐานข้อมูล Cloudflare D1 (SQLite)
-- ข้อมูลธุรกิจเก็บในตาราง records (หนึ่งแถวต่อหนึ่งรายการ ข้อมูลเป็น JSON) เพื่อให้ซิงก์ 2 เครื่อง/ออฟไลน์ได้ด้วยเลข seq ตัวเดียว
-- tbl: settings, rooms, customers, bookings, payments, closures, priceRules, issues, categories, fixedCosts, requests, surveys, audit
-- เงินเป็นสตางค์ (integer) ทุกจำนวน · ไม่ลบจริง ใช้ deleted_at (soft delete)

CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
INSERT INTO meta (key, value) VALUES ('seq', '0');

CREATE TABLE records (
  tbl TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  PRIMARY KEY (tbl, id)
);
CREATE INDEX records_seq ON records (seq);

-- ประวัติการแก้ไขแบบเต็ม (ก่อน/หลัง) — สรุปสั้นของแต่ละรายการซิงก์ไปที่แอปผ่าน records tbl='audit'
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  action TEXT NOT NULL,
  before TEXT,
  after TEXT,
  actor TEXT NOT NULL,
  device TEXT,
  at TEXT NOT NULL
);
CREATE INDEX audit_log_row ON audit_log (row_id);

-- คืนที่พักของการจองที่ยังมีผล (เซิร์ฟเวอร์สร้างจาก bookings) ใช้กันจองเกินด้วย trigger
CREATE TABLE booking_nights (
  booking_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  night TEXT NOT NULL,
  guests INTEGER NOT NULL,
  whole INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (booking_id, room_id, night)
);
CREATE INDEX booking_nights_night ON booking_nights (night, room_id);

CREATE TRIGGER booking_nights_guard AFTER INSERT ON booking_nights
WHEN (SELECT value FROM meta WHERE key = 'restoring') IS NULL
BEGIN
  SELECT RAISE(ABORT, 'CLOSED') WHERE (SELECT json_extract(data, '$.isActive') FROM records WHERE tbl = 'rooms' AND id = NEW.room_id AND deleted_at IS NULL) IS NOT 1;
  SELECT RAISE(ABORT, 'CLOSED') WHERE EXISTS (
    SELECT 1 FROM records WHERE tbl = 'closures' AND deleted_at IS NULL
      AND json_extract(data, '$.start') <= NEW.night AND json_extract(data, '$.end') >= NEW.night
      AND (json_extract(data, '$.roomId') IS NULL OR json_extract(data, '$.roomId') = NEW.room_id));
  SELECT RAISE(ABORT, 'WHOLE_ROOM') WHERE EXISTS (
    SELECT 1 FROM booking_nights WHERE room_id = NEW.room_id AND night = NEW.night AND booking_id <> NEW.booking_id AND (whole = 1 OR NEW.whole = 1));
  SELECT RAISE(ABORT, 'ROOM_FULL') WHERE (SELECT SUM(guests) FROM booking_nights WHERE room_id = NEW.room_id AND night = NEW.night)
    > (SELECT json_extract(data, '$.capacity') FROM records WHERE tbl = 'rooms' AND id = NEW.room_id);
  SELECT RAISE(ABORT, 'HOUSE_FULL') WHERE (SELECT SUM(guests) FROM booking_nights WHERE night = NEW.night)
    > (SELECT COALESCE(SUM(json_extract(data, '$.capacity')), 0) FROM records WHERE tbl = 'rooms' AND deleted_at IS NULL AND json_extract(data, '$.isActive') = 1);
END;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  pass_hash TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  device TEXT,
  created_at TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- กันบันทึกซ้ำเมื่อกดซ้ำหรือส่งคิวซ้ำ (idempotency key)
CREATE TABLE ops (
  op_id TEXT PRIMARY KEY,
  result TEXT,
  at TEXT NOT NULL
);

-- รูปสลิป / รูปปัญหา (ย่อเป็น WebP ≤ 200 KB ก่อนอัปโหลด)
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_hash TEXT,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_label TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE notification_log (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload TEXT,
  status TEXT,
  sent_at TEXT NOT NULL
);

CREATE TABLE backups (
  id TEXT PRIMARY KEY,
  at TEXT NOT NULL,
  rows INTEGER NOT NULL,
  size INTEGER NOT NULL,
  data BLOB NOT NULL
);

CREATE TABLE client_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  message TEXT,
  detail TEXT,
  url TEXT,
  ua TEXT
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
