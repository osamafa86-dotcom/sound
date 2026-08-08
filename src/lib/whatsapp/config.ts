/**
 * واتساب عبر Meta Cloud API — رسائل واتساب حقيقية إلى أرقام حقيقية.
 *
 * الفرق الجوهري عن أي تطبيق مراسلة نبنيه: الطرف الآخر **لا يثبّت شيئاً**.
 * يكتب لك من واتساب الذي في هاتفه أصلاً، ونحن نستقبل ونردّ عبر واجهة Meta.
 *
 * خطوات إنشاء التطبيق والحصول على القيم في docs/whatsapp-setup.md
 */

/** أحدث نسخة مدعومة وقت البناء — قابلة للترقية بمتغير بيئة */
export const WA_VERSION = process.env.WHATSAPP_API_VERSION?.trim() || "v23.0";
export const WA_BASE = `https://graph.facebook.com/${WA_VERSION}`;

export type WhatsAppConfig = {
  /** معرّف رقم الأعمال المرسِل (Phone number ID من لوحة Meta) */
  phoneNumberId: string;
  /** رمز وصول: مؤقت للتجربة، أو دائم من System User للإنتاج */
  token: string;
  /** الكلمة السرية التي تُدخلها في إعداد الـ webhook لدى Meta */
  verifyToken: string;
  /** سرّ التطبيق — به يُتحقق من توقيع كل حمولة واردة */
  appSecret: string | null;
};

export function whatsappConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!phoneNumberId || !token || !verifyToken) return null;

  return {
    phoneNumberId,
    token,
    verifyToken,
    // سرّ تطبيق Meta نفسه — نقبل اسم متغير فيسبوك الموجود أصلاً
    appSecret: process.env.WHATSAPP_APP_SECRET?.trim() || process.env.FACEBOOK_APP_SECRET?.trim() || null,
  };
}

export function whatsappConfigured(): boolean {
  return whatsappConfig() !== null;
}
