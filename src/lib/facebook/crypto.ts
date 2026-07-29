import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

/**
 * حماية رموز الصفحات وحالة OAuth.
 *
 * رمز الصفحة **بلا تاريخ انتهاء**: من يقرأه ينشر على صفحة صاحبه إلى أجل غير
 * مسمى. لذا لا يُخزَّن نصاً صريحاً حتى داخل قاعدة بيانات محمية — يُشفَّر
 * بـ AES-256-GCM بمفتاح من بيئة الخادم، فتسريب نسخة من الجدول وحده لا يكفي.
 */

// اشتقاق المفتاح بطيء عمداً، فنحفظ الناتج لكل سرّ بدل تكراره في كل عملية
const keyCache = new Map<string, Buffer>();

function keyFrom(secret: string): Buffer {
  const cached = keyCache.get(secret);
  if (cached) return cached;
  const key = scryptSync(secret, "maqam-facebook-v1", 32);
  keyCache.set(secret, key);
  return key;
}

/** تشفير رمز: v1.<iv>.<نص مشفّر>.<وسم التحقق> بترميز base64url */
export function encryptToken(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFrom(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    encrypted.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}

/** فكّ التشفير — يعيد null لأي عبث بالنص المشفّر أو خطأ في المفتاح */
export function decryptToken(payload: string, secret: string): string | null {
  const [version, iv, body, tag] = payload.split(".");
  if (version !== "v1" || !iv || !body || !tag) return null;

  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFrom(secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(body, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * توقيع حالة OAuth — يمنع تزوير رحلة الموافقة (CSRF): من يعيدنا من فيسبوك
 * يجب أن يحمل حالةً وقّعها خادمنا نفسه.
 */
export function signState(payload: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${mac}`;
}

/** يتحقق من التوقيع ويعيد الحمولة، أو null إن لم تطابق */
export function verifyState(signed: string, secret: string): string | null {
  const [encoded, mac] = signed.split(".");
  if (!encoded || !mac) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");

  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  // المقارنة بزمن ثابت حتى لا يُستدلّ على التوقيع الصحيح من زمن الرفض
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return payload;
}

/**
 * برهان صحة الاستدعاء الذي يطلبه فيسبوك مع الرموز (appsecret_proof):
 * توقيع الرمز بسرّ التطبيق، فلا ينفع رمز مسروق وحده من خارج خادمنا.
 */
export function appSecretProof(accessToken: string, appSecret: string): string {
  return createHmac("sha256", appSecret).update(accessToken).digest("hex");
}
