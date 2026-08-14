/**
 * بوابة كلمة سر الموقع — طبقة حماية بسيطة قبل أي استخدام (يحمي أرصدة المزوّدين
 * المدفوعة من الزوار العشوائيين قبل إطلاق الموقع رسمياً). كلمة سر واحدة مشتركة،
 * لا حسابات ولا صلاحيات — منفصلة تماماً عن نظام حسابات Supabase.
 *
 * تعمل في بيئتين مختلفتين (Edge middleware و Node route handlers) فتعتمد فقط
 * على Web Crypto (`crypto.subtle`) المتاحة في كليهما — لا `node:crypto`.
 */

export const GATE_COOKIE = "mqaam_gate";
/** صلاحية جلسة الدخول: ٣٠ يوماً — كافية لتصفّح مريح دون إزعاج بإعادة الطلب */
export const GATE_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;

/** كلمة السر الفعلية — قابلة للتغيير عبر SITE_PASSWORD بيئياً، والافتراضي admin123 */
export function sitePassword(): string {
  return process.env.SITE_PASSWORD || "admin123";
}

/** سرّ توقيع الجلسة — منفصل عن كلمة السر حتى لا يُستنتَج منها لو تغيّرت لاحقاً */
function gateSecret(): string {
  return process.env.SITE_GATE_SECRET || `mqaam-gate::${sitePassword()}`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(gateSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return toHex(sig);
}

/** مقارنة بزمن ثابت — تمنع تسريب الفرق عبر توقيت الاستجابة */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** هل كلمة السر المُدخَلة صحيحة؟ */
export function checkGatePassword(candidate: string): boolean {
  return timingSafeEqual(candidate, sitePassword());
}

/** يُنشئ رمز جلسة موقّعاً صالحاً لمدة GATE_TOKEN_TTL_SEC */
export async function createGateToken(): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + GATE_TOKEN_TTL_SEC;
  const sig = await hmacHex(String(exp));
  return `${exp}.${sig}`;
}

/** يتحقق من رمز الجلسة القادم من الكوكي: التوقيع صحيح ولم تنتهِ صلاحيته */
export async function verifyGateToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expStr = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmacHex(expStr);
  return timingSafeEqual(sig, expected);
}
