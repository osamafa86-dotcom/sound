import { siteOrigin } from "@/lib/share";

/**
 * إعداد تطبيق Meta — كل شيء يُقرأ من بيئة الخادم، ولا يصل المتصفح منه
 * إلا ما لا ضرر في كشفه. غياب المفاتيح يُبقي الميزة مخفية بلا أي عطل.
 *
 * خطوات إنشاء التطبيق والحصول على القيم موثّقة في docs/facebook-app.md
 */

/** أحدث نسخة مدعومة من Graph API وقت كتابة التكامل — قابلة للترقية بمتغير بيئة */
export const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION?.trim() || "v25.0";

export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/** الأذونات المطلوبة للنشر على صفحة يديرها المستخدم */
export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_manage_metadata",
  "pages_read_engagement",
] as const;

export type FacebookConfig = {
  appId: string;
  appSecret: string;
  /** سرّ تشفير رموز الصفحات المخزّنة — يعود لسرّ التطبيق إن لم يُضبط */
  tokenSecret: string;
};

export function facebookConfig(): FacebookConfig | null {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;

  return {
    appId,
    appSecret,
    tokenSecret: process.env.FACEBOOK_TOKEN_SECRET?.trim() || appSecret,
  };
}

export function facebookConfigured(): boolean {
  return facebookConfig() !== null;
}

/**
 * رابط الرجوع بعد الموافقة — يجب أن يطابق حرفياً ما هو مسجّل في
 * Valid OAuth Redirect URIs داخل لوحة Meta، وإلا رفض فيسبوك الطلب.
 */
export function facebookRedirectUri(req?: { headers: Headers }): string {
  const explicit = process.env.FACEBOOK_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${siteOrigin(req)}/api/facebook/callback`;
}
