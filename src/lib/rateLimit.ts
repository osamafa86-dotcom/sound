/**
 * حماية الاستهلاك — سياج يمنع استنزاف أرصدة المزوّدين المدفوعة.
 *
 * التخزين في ذاكرة النسخة (in-memory): على Vercel لكل نسخة serverless ذاكرتها،
 * فالحدود تقريبية لا مطلقة — لكنها توقف الإساءة العملية (سكربت يستدعي بلا توقف).
 * تُستبدل بمخزن مشترك (Redis/Postgres) عند بناء الحسابات في المرحلة 4.
 */

export type LimitRule = {
  /** أقصى عدد طلبات ضمن النافذة لكل زائر */
  perVisitor: number;
  /** أقصى عدد طلبات إجمالي للمنصة ضمن النافذة (سقف حماية المحفظة) */
  global: number;
  /** طول النافذة بالمللي ثانية */
  windowMs: number;
};

/** حدود كل مسار — الموسيقى أغلى بكثير فحدودها أضيق */
export const LIMITS: Record<string, LimitRule> = {
  tts: { perVisitor: 20, global: 300, windowMs: 60 * 60 * 1000 },
  songs: { perVisitor: 5, global: 60, windowMs: 60 * 60 * 1000 },
  lyrics: { perVisitor: 30, global: 400, windowMs: 60 * 60 * 1000 },
  voiceDesign: { perVisitor: 5, global: 40, windowMs: 60 * 60 * 1000 },
  voiceClone: { perVisitor: 3, global: 20, windowMs: 24 * 60 * 60 * 1000 },
  pronunciation: { perVisitor: 30, global: 200, windowMs: 60 * 60 * 1000 },
};

type Bucket = { count: number; resetAt: number };

const visitorBuckets = new Map<string, Bucket>();
const globalBuckets = new Map<string, Bucket>();

/** تنظيف دوري كسول حتى لا تنمو الخريطة بلا حدود */
function sweep(map: Map<string, Bucket>, now: number) {
  if (map.size < 5000) return;
  for (const [k, b] of map) if (b.resetAt <= now) map.delete(k);
}

function hit(map: Map<string, Bucket>, key: string, limit: number, windowMs: number, now: number) {
  const bucket = map.get(key);
  if (!bucket || bucket.resetAt <= now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }
  if (bucket.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }
  bucket.count++;
  return { allowed: true, remaining: limit - bucket.count, resetAt: bucket.resetAt };
}

/** معرّف الزائر — عنوان IP كما يمرره Vercel */
export function visitorKey(req: Request): string {
  const headers = req.headers;
  const forwarded = headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

export type LimitVerdict = {
  allowed: boolean;
  /** true عندما يكون الرفض بسبب السقف العام للمنصة لا بسبب الزائر */
  globalCap?: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
};

/** فحص وتسجيل طلب واحد على مسار محدّد */
export function checkLimit(req: Request, route: keyof typeof LIMITS): LimitVerdict {
  const rule = LIMITS[route];
  const now = Date.now();
  sweep(visitorBuckets, now);
  sweep(globalBuckets, now);

  const global = hit(globalBuckets, route, rule.global, rule.windowMs, now);
  if (!global.allowed) {
    return {
      allowed: false,
      globalCap: true,
      remaining: 0,
      resetAt: global.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((global.resetAt - now) / 1000)),
    };
  }

  const visitor = hit(visitorBuckets, `${route}:${visitorKey(req)}`, rule.perVisitor, rule.windowMs, now);
  return {
    allowed: visitor.allowed,
    remaining: visitor.remaining,
    resetAt: visitor.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((visitor.resetAt - now) / 1000)),
  };
}

/** رسالة عربية مفهومة + ترويسات معيارية عند تجاوز الحد */
export function limitResponse(verdict: LimitVerdict): Response {
  const minutes = Math.ceil(verdict.retryAfterSec / 60);
  const message = verdict.globalCap
    ? `المنصة تستقبل عدداً كبيراً من الطلبات الآن. جرّب بعد ${minutes} دقيقة.`
    : `تجاوزت الحد المسموح من الطلبات. جرّب مجدداً بعد ${minutes} دقيقة.`;

  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(verdict.retryAfterSec),
      "X-RateLimit-Remaining": String(verdict.remaining),
      "X-RateLimit-Reset": String(Math.floor(verdict.resetAt / 1000)),
    },
  });
}
