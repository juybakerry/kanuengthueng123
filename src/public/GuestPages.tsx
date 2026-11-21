/** หน้าที่ลูกค้าเปิดจากลิงก์: /pay/<token> (ยอดและ QR พร้อมเพย์) · /review/<token> (12. ขอบคุณ / แบบประเมิน) */
import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { qrDataUrl } from '../lib/share';
import { fmtDate, fmtRange } from '../domain/dates';
import { fmtBaht } from '../domain/money';
import { STAR_LABELS, SURVEY_TAGS } from '../domain/defaults';
import type { HomestayInfo } from '../domain/types';

export function ReviewPage({ token }: { token: string }) {
  const [info, setInfo] = useState<{ name: string; range: string; done: boolean } | null>(null);
  const [err, setErr] = useState('');
  const [score, setScore] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.theme = 'campfire';
    void api<{ name: string; range: string; done: boolean }>(`/api/public/survey/${token}`)
      .then((r) => {
        setInfo(r);
        setSent(r.done);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'เปิดลิงก์ไม่สำเร็จ'));
  }, [token]);

  async function submit() {
    setBusy(true);
    try {
      await api(`/api/public/survey/${token}`, { body: { score, tags, comment } });
      setSent(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'ส่งไม่สำเร็จ ลองอีกครั้งเน้อ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pub-dark">
      <div style={{ flex: 1, overflowY: 'auto', padding: 'calc(120px + var(--sat)) 20px calc(32px + var(--sab))' }}>
        <div className="col gap16" style={{ maxWidth: 480, margin: '0 auto' }}>
          <div className="col center" style={{ alignItems: 'center', gap: 6 }}>
            <img src="/assets/logo-mark.png" alt="" width={56} height={56} style={{ borderRadius: 14 }} />
            <div className="hand" style={{ fontSize: 30, lineHeight: 1.35, animation: 'mistIn 900ms var(--ease) both' }}>
              ขอบคุณที่มาพักผ่อน
              <br />
              ไว้มาพบกันใหม่เน้อ
            </div>
            <div style={{ fontSize: 15, opacity: 0.85 }}>{info ? `${info.name} · ใช้เวลาไม่ถึง 30 วินาที` : err || '…'}</div>
          </div>
          {info && !sent && (
            <>
              <div className="col" style={{ alignItems: 'center', gap: 6 }}>
                <div className="row" style={{ gap: 6 }} role="radiogroup" aria-label="ให้คะแนน">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={score === n} aria-label={`${n} ดาว ${STAR_LABELS[n]}`} onClick={() => setScore(n)} style={{ width: 52, height: 52, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill={n <= score ? '#E8893A' : 'none'} stroke={n <= score ? '#E8893A' : '#B9B3A8'} strokeWidth="1.5" strokeLinejoin="round">
                        <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.13 5.11a.56.56 0 0 0 .48.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 0 0-.18.56l1.28 5.39a.56.56 0 0 1-.84.61l-4.73-2.89a.56.56 0 0 0-.59 0l-4.73 2.89a.56.56 0 0 1-.84-.61l1.28-5.39a.56.56 0 0 0-.18-.56l-4.2-3.6a.56.56 0 0 1 .32-.99l5.52-.44a.56.56 0 0 0 .48-.35z" />
                      </svg>
                    </button>
                  ))}
                </div>
                <span className="b" style={{ fontSize: 15, minHeight: 24 }}>
                  {STAR_LABELS[score]}
                </span>
              </div>
              <div className="chips" style={{ justifyContent: 'center' }}>
                {SURVEY_TAGS.map((t) => (
                  <button key={t} type="button" className="chip" aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])} style={tags.includes(t) ? { background: '#E8893A', color: '#161311' } : { background: 'rgba(243,241,235,.12)', color: '#F3F1EB' }}>
                    {t}
                  </button>
                ))}
              </div>
              <textarea className="textarea" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="อยากบอกอะไรเราเพิ่มเติมไหม (ไม่บังคับ)" style={{ background: 'rgba(243,241,235,.12)', color: '#F3F1EB' }} aria-label="ความเห็นเพิ่มเติม" />
              {err && <div className="alert">{err}</div>}
              <button type="button" className="btn btn-lg" disabled={!score || busy} onClick={() => void submit()} style={{ background: score ? '#E8893A' : 'rgba(243,241,235,.15)', color: score ? '#161311' : '#B9B3A8' }}>
                ส่งคะแนน
              </button>
            </>
          )}
          {sent && (
            <div className="col center" style={{ alignItems: 'center', gap: 8, padding: '12px 0', animation: 'mistIn 500ms var(--ease)' }}>
              <Flame size={28} color="#E8893A" />
              <div className="b" style={{ fontSize: 18 }}>
                ได้รับคะแนนแล้ว ขอบคุณมากเน้อ
              </div>
              <div style={{ fontSize: 15, opacity: 0.85 }}>กองไฟรอบหน้า เก็บที่ไว้ให้แล้ว</div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

interface PayInfo {
  name: string;
  code: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  status: string;
  total: number;
  paid: number;
  due: number;
  deposit: number;
  depositDueOn: string;
  payNow: number;
  qr: string | null;
  promptpayName: string;
  bankAccount: string;
  homestay: HomestayInfo;
  checkInTime: string;
  checkOutTime: string;
}

export function PayPage({ token }: { token: string }) {
  const [d, setD] = useState<PayInfo | null>(null);
  const [img, setImg] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => {
    document.documentElement.dataset.theme = 'mist';
    void api<PayInfo>(`/api/public/booking/${token}`)
      .then(async (r) => {
        setD(r);
        if (r.qr) setImg(await qrDataUrl(r.qr, 480));
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'เปิดลิงก์ไม่สำเร็จ'));
  }, [token]);
  return (
    <div className="pub" style={{ padding: 'calc(24px + var(--sat)) 16px calc(32px + var(--sab))' }}>
      <div className="col gap16" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="row" style={{ gap: 10 }}>
          <img src="/assets/logo-mark.png" alt="" width={44} height={44} style={{ borderRadius: 12 }} />
          <div className="heading" style={{ fontSize: 20 }}>
            {d?.homestay.name ?? 'คะนึงถึง ห้วยกุ๊บกั๊บ โฮมสเตย์'}
          </div>
        </div>
        {err && <div className="alert">{err}</div>}
        {d && (
          <>
            <div className="card">
              <div className="small muted">การจอง {d.code}</div>
              <div className="heading" style={{ fontSize: 24 }}>
                {d.name}
              </div>
              <div>
                {fmtRange(d.checkIn, d.checkOut)} · {d.guests} คน · เช็คอิน {d.checkInTime} · เช็คเอาท์ {d.checkOutTime}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                <div>
                  <div className="small muted">ยอดรวม</div>
                  <div className="b num">{fmtBaht(d.total)}</div>
                </div>
                <div>
                  <div className="small muted">ชำระแล้ว</div>
                  <div className="b num ok">{fmtBaht(d.paid)}</div>
                </div>
                <div>
                  <div className="small muted">คงเหลือ</div>
                  <div className="b num ember">{fmtBaht(d.due)}</div>
                </div>
              </div>
            </div>
            {d.status === 'cancelled' ? (
              <div className="alert info">การจองนี้ถูกยกเลิกแล้ว</div>
            ) : d.payNow > 0 ? (
              <div className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div className="b">{d.paid <= 0 ? `ชำระมัดจำภายใน ${fmtDate(d.depositDueOn)}` : `ชำระส่วนที่เหลือวันเข้าพัก ${fmtDate(d.checkIn)}`}</div>
                {img ? <img src={img} alt="QR พร้อมเพย์" width={240} height={240} style={{ background: '#fff', padding: 10, borderRadius: 12 }} /> : <div className="small muted">ติดต่อโฮมสเตย์เพื่อรับช่องทางชำระเงิน</div>}
                <div className="b num" style={{ fontSize: 30 }}>
                  {fmtBaht(d.payNow)}
                </div>
                {d.promptpayName && <div className="small muted">พร้อมเพย์ {d.promptpayName}</div>}
                {d.bankAccount && <div className="small">หรือโอนเข้าบัญชี {d.bankAccount}</div>}
                <div className="small muted">โอนแล้วส่งสลิปในแชท LINE {d.homestay.lineId} ได้เลยเน้อ</div>
              </div>
            ) : (
              <div className="alert info">ชำระครบแล้ว ขอบคุณมากเน้อ</div>
            )}
            <div className="hand center" style={{ fontSize: 22 }}>
              ไว้มาพบกันใหม่เน้อ
            </div>
          </>
        )}
      </div>
    </div>
  );
}
