import { randomUUID } from "node:crypto";

/**
 * المشاركة برابط عام — الطبقة التي يقوم عليها أي نشر خارجي.
 *
 * ملفات المستخدمين خاصة في التخزين، فالرابط العام ليس رابط الملف بل صفحة
 * على مقام (`/s/<id>`) تحمل وسوم OG وتُشغّل الصوت عبر مسار وسيط. هكذا يبقى
 * مسار التخزين مخفياً، ويستطيع صاحب العمل إلغاء المشاركة في أي لحظة.
 */

/** معرّف مشاركة غير قابل للتخمين — ٢٢ حرفاً من ١٢٨ بت */
export function newShareId(): string {
  return Buffer.from(randomUUID().replace(/-/g, ""), "hex").toString("base64url");
}

/**
 * أصل الموقع كما يراه الزائر: المتغير الصريح أولاً (أدقّ عند النطاق المخصص)،
 * ثم ترويسات الطلب، ثم نطاق Vercel.
 */
export function siteOrigin(req?: { headers: Headers }): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const host = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host");
  if (host) {
    const proto = req?.headers.get("x-forwarded-proto") ?? "https";
    return `${proto}://${host}`;
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return vercel ? `https://${vercel}` : "http://localhost:3000";
}

/** رابط صفحة المشاركة العامة */
export function shareUrl(shareId: string, origin: string): string {
  return `${origin.replace(/\/+$/, "")}/s/${shareId}`;
}
