// สร้างบัญชีผู้ใช้ (ใช้ครั้งแรก หรือเมื่อลืมรหัสของเจ้าของ): ต้องมี ADMIN_TOKEN ของเซิร์ฟเวอร์
//   node scripts/create-user.mjs <URL> <ADMIN_TOKEN> <username> <ชื่อที่แสดง> <owner|staff> [รหัสผ่าน]
// ถ้าไม่ใส่รหัสผ่าน จะสุ่มรหัสให้และพิมพ์ออกมา
const [url, token, username, displayName, role = 'staff', given] = process.argv.slice(2);
if (!url || !token || !username || !displayName) {
  console.error('usage: node scripts/create-user.mjs <URL> <ADMIN_TOKEN> <username> <displayName> <owner|staff> [password]');
  process.exit(1);
}
const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const password = given ?? Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % alphabet.length]).join('');
const r = await fetch(`${url.replace(/\/$/, '')}/api/admin/users`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, displayName, password, role }),
});
const body = await r.text();
if (!r.ok) {
  console.error(r.status, body);
  process.exit(1);
}
console.log(JSON.stringify({ username, displayName, role, password }));
