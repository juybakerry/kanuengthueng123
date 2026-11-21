# คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์ — กติกาโปรเจกต์

- อ่าน `docs/SPEC.md` (SRS v1.0) และ `docs/REQUIREMENTS.md` (Requirement Form v1.1) ก่อนเริ่มงาน · ดีไซน์อ้างอิง `docs/DESIGN-HANDOFF.md`
- ต้องฟรี 100%: ห้ามเพิ่มบริการ/แพ็กเกจที่มีค่าใช้จ่ายหรือบังคับผูกบัตร โดยไม่ถามก่อน (เจ้าของไม่ผูกบัตร จึงไม่ใช้ R2 — เก็บรูปใน D1)
- สถาปัตยกรรม: Cloudflare Worker ตัวเดียว (`worker/`) เสิร์ฟ PWA (`dist/`) + `/api/*` + cron ทุกชั่วโมง · ฐานข้อมูล D1 `kanuengthueng` บนบัญชี juybakerry
- PWA ต้องใช้ได้บน iOS 16.4+, iPadOS 16.4+, Android Chrome — ทดสอบ Safari ทุกครั้งที่แก้หน้าจอ
- TypeScript strict; ห้ามใช้ any โดยไม่มีเหตุผล
- เงินเป็น integer สตางค์ (ไม่ใช้ float); วันที่เข้าพักเป็น 'YYYY-MM-DD' ตามเวลาไทย (Asia/Bangkok)
- กฎธุรกิจอยู่ใน `src/domain` เท่านั้น (ใช้ร่วมกันทั้งแอปและ Worker) และต้องมี unit test; ห้ามคำนวณเงินซ้ำในคอมโพเนนต์
- เปลี่ยนฐานข้อมูลผ่านไฟล์ใน `migrations/` เท่านั้น; ข้อมูลธุรกิจอยู่ในตาราง `records` (JSON ต่อแถว + seq สำหรับซิงก์)
- ห้ามใส่ค่าลับในโค้ด: ค่าลับอยู่ใน `wrangler secret` และสำเนาใน `.secrets/` (gitignore) เท่านั้น
- D1 ฟรี: จำกัด 50 query ต่อคำขอ, อ่าน 5 ล้านแถว/วัน และเขียน 100,000 แถว/วัน ทั้งบัญชี (ใช้ร่วมกับแอปอื่น) — ระวัง query ที่ต้นทุนโตตามข้อมูล
- ก่อน commit: `npm run typecheck && npm test && npm run build` ต้องผ่าน และ `node scripts/e2e-api.mjs` กับเซิร์ฟเวอร์ local (`npm run worker:dev`)
- Windows เครื่องนี้: ใส่ `COMSPEC='C:\Windows\system32\cmd.exe'` หน้า npm/wrangler ใน bash
