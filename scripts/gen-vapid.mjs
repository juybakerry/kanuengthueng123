// สร้างคีย์ VAPID สำหรับ Web Push (ครั้งเดียว) → พิมพ์ public key และ private key (d) แบบ base64url
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey);
const b64 = (u) => Buffer.from(u).toString('base64url');
console.log(JSON.stringify({ publicKey: b64(raw), privateKey: jwk.d }));
