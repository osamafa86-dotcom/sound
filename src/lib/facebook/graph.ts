import { appSecretProof } from "./crypto";
import { FACEBOOK_SCOPES, GRAPH_BASE, GRAPH_VERSION, type FacebookConfig } from "./config";

/**
 * نداءات Graph API التي يحتاجها النشر على الصفحات — رقيقة عمداً وبلا حالة،
 * فكل خطوة قابلة للاختبار والاستبدال وحدها.
 */

export type ManagedPage = {
  id: string;
  name: string;
  category: string | null;
  /** رمز الصفحة — طويل الأجل بلا انتهاء متى اشتُقّ من رمز مستخدم طويل الأجل */
  accessToken: string;
};

class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number
  ) {
    super(message);
  }
}

/** يقرأ خطأ Graph بصيغته المعروفة ويحوّله إلى رسالة عربية مفهومة */
async function graphFetch(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const data = (await res.json().catch(() => null)) as {
    error?: { message?: string; code?: number; error_user_msg?: string };
  } | null;

  if (!res.ok || data?.error) {
    const error = data?.error;
    const detail = error?.error_user_msg || error?.message || `HTTP ${res.status}`;
    throw new GraphError(`فيسبوك رفض الطلب: ${detail}`, res.status, error?.code);
  }
  return (data ?? {}) as Record<string, unknown>;
}

/** رابط نافذة الموافقة التي يُحوَّل إليها المستخدم */
export function authorizeUrl(cfg: FacebookConfig, redirectUri: string, state: string): string {
  const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", FACEBOOK_SCOPES.join(","));
  return url.toString();
}

/** الخطوة ١: رمز التفويض ← رمز مستخدم قصير الأجل (ساعات) */
export async function exchangeCode(
  cfg: FacebookConfig,
  code: string,
  redirectUri: string
): Promise<string> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const data = await graphFetch(url.toString());
  const token = data.access_token;
  if (typeof token !== "string") throw new GraphError("لم يُعد فيسبوك رمز وصول", 502);
  return token;
}

/**
 * الخطوة ٢: رمز قصير الأجل ← رمز مستخدم طويل الأجل (~٦٠ يوماً).
 * تتم على الخادم حصراً لأن سرّ التطبيق يدخل في الطلب.
 */
export async function toLongLivedToken(
  cfg: FacebookConfig,
  shortToken: string
): Promise<{ token: string; expiresIn: number | null }> {
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", cfg.appId);
  url.searchParams.set("client_secret", cfg.appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);

  const data = await graphFetch(url.toString());
  const token = data.access_token;
  if (typeof token !== "string") throw new GraphError("تعذّر تمديد صلاحية الرمز", 502);
  return { token, expiresIn: typeof data.expires_in === "number" ? data.expires_in : null };
}

/**
 * الخطوة ٣: الصفحات التي يديرها المستخدم ورمز كل صفحة.
 * الرمز المشتقّ من رمز مستخدم طويل الأجل لا تنتهي صلاحيته.
 */
export async function listManagedPages(
  cfg: FacebookConfig,
  userToken: string
): Promise<ManagedPage[]> {
  const url = new URL(`${GRAPH_BASE}/me/accounts`);
  url.searchParams.set("fields", "id,name,category,access_token");
  url.searchParams.set("limit", "100");
  url.searchParams.set("access_token", userToken);
  url.searchParams.set("appsecret_proof", appSecretProof(userToken, cfg.appSecret));

  const data = await graphFetch(url.toString());
  const rows = Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : [];

  return rows
    .filter((row) => typeof row.id === "string" && typeof row.access_token === "string")
    .map((row) => ({
      id: row.id as string,
      name: typeof row.name === "string" ? row.name : (row.id as string),
      category: typeof row.category === "string" ? row.category : null,
      accessToken: row.access_token as string,
    }));
}

export type PublishedPost = { postId: string; permalink: string };

/**
 * منشور برابط على الصفحة.
 *
 * لماذا رابط لا ملف صوتي؟ لأن Graph API لا ينشر صوتاً خاماً إطلاقاً — ينشر
 * فيديو mp4 (برفع مستأنف يحتاج تحويلاً بـ ffmpeg) أو منشوراً برابط. فننشر
 * رابط صفحة المشاركة على مقام: تظهر بطاقة المعاينة، ويستمع الناس عند المصدر.
 */
export async function publishLink(
  cfg: FacebookConfig,
  pageId: string,
  pageToken: string,
  message: string,
  link: string
): Promise<PublishedPost> {
  const body = new URLSearchParams({
    message,
    link,
    access_token: pageToken,
    appsecret_proof: appSecretProof(pageToken, cfg.appSecret),
  });

  const data = await graphFetch(`${GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const postId = typeof data.id === "string" ? data.id : "";
  if (!postId) throw new GraphError("نُشر الطلب لكن لم يُعد فيسبوك معرّف المنشور", 502);
  return { postId, permalink: `https://www.facebook.com/${postId}` };
}
