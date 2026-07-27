import { getSupabaseAdmin } from "./supabaseAdmin";
import { consumeCredits } from "./credits";
import { gateFor, getPlatformSettings } from "./platformSettings";

/**
 * حماية الاستهلاك — سياج يمنع استنزاف أرصدة المزوّدين المدفوعة.
 *
 * ثلاث طبقات لكل مسار:
 * 0. مفتاح إيقاف يملكه صاحب النظام من لوحة المالك (صيانة أو إيقاف مسار بعينه)
 * 1. سقف عام للمنصة (حماية المحفظة من الإساءة الجماعية)
 * 2. حد لكل زائر (IP) أو مستخدم — المسجلون يحصلون على أضعاف الحد
 *
 * التخزين: دالة SQL ذرّية في Supabase على الإنتاج (نسخ Serverless لا تتشارك
 * ذاكرة)، وعدّاد محلي في التطوير أو عند تعذر القاعدة.
 */

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export type LimitRule = {
  /** أقصى عدد طلبات ضمن النافذة لكل زائر غير مسجل */
  perVisitor: number;
  /** أقصى عدد طلبات إجمالي للمنصة ضمن النافذة (سقف حماية المحفظة) */
  global: number;
  /** طول النافذة بالثواني */
  windowSec: number;
};

/** حدود كل مسار — الموسيقى والاستنساخ أغلى فحدودها أضيق */
export const LIMITS = {
  tts: { perVisitor: envInt("RATE_LIMIT_TTS", 20), global: 300, windowSec: 3600 },
  songs: { perVisitor: envInt("RATE_LIMIT_SONGS", 6), global: 60, windowSec: 3600 },
  lyrics: { perVisitor: envInt("RATE_LIMIT_LYRICS", 30), global: 400, windowSec: 3600 },
  stt: { perVisitor: envInt("RATE_LIMIT_STT", 8), global: 120, windowSec: 3600 },
  sts: { perVisitor: envInt("RATE_LIMIT_STS", 6), global: 80, windowSec: 3600 },
  isolate: { perVisitor: envInt("RATE_LIMIT_ISOLATE", 6), global: 80, windowSec: 3600 },
  voiceClone: { perVisitor: envInt("RATE_LIMIT_CLONE", 3), global: 20, windowSec: 24 * 3600 },
  voiceDesign: { perVisitor: envInt("RATE_LIMIT_DESIGN", 5), global: 40, windowSec: 3600 },
  pronunciation: { perVisitor: envInt("RATE_LIMIT_PRONUNCIATION", 30), global: 200, windowSec: 3600 },
  enhance: { perVisitor: envInt("RATE_LIMIT_ENHANCE", 30), global: 400, windowSec: 3600 },
  imageBrief: { perVisitor: envInt("RATE_LIMIT_IMAGE_BRIEF", 10), global: 120, windowSec: 3600 },
  drama: { perVisitor: envInt("RATE_LIMIT_DRAMA", 5), global: 50, windowSec: 3600 },
  cover: { perVisitor: envInt("RATE_LIMIT_COVER", 8), global: 80, windowSec: 3600 },
  signals: { perVisitor: envInt("RATE_LIMIT_SIGNALS", 120), global: 3000, windowSec: 3600 },
  prompts: { perVisitor: envInt("RATE_LIMIT_PROMPTS", 20), global: 300, windowSec: 3600 },
  promptAgent: { perVisitor: envInt("RATE_LIMIT_PROMPT_AGENT", 60), global: 900, windowSec: 3600 },
  promptTest: { perVisitor: envInt("RATE_LIMIT_PROMPT_TEST", 6), global: 60, windowSec: 3600 },
  support: { perVisitor: envInt("RATE_LIMIT_SUPPORT", 5), global: 100, windowSec: 3600 },
  pay: { perVisitor: envInt("RATE_LIMIT_PAY", 10), global: 200, windowSec: 3600 },
  // الحفظ في المكتبة رخيص (تخزين فقط) — نطاق مستقل كي لا يستهلك حصة التوليد
  save: { perVisitor: envInt("RATE_LIMIT_SAVE", 60), global: 1000, windowSec: 3600 },
  // عينات المعرض تُولَّد مرة لكل صوت ثم تُخزَّن — الحد للتوليد الأول فقط
  sample: { perVisitor: envInt("RATE_LIMIT_SAMPLE", 40), global: 300, windowSec: 3600 },
} satisfies Record<string, LimitRule>;

export type LimitScope = keyof typeof LIMITS;

/** مضاعف حدود المستخدمين المسجلين */
export const SIGNED_IN_MULTIPLIER = envInt("RATE_LIMIT_SIGNED_IN_MULTIPLIER", 3);

type MemoryWindow = { windowStart: number; count: number };
const globalStore = globalThis as unknown as { __rateLimits?: Map<string, MemoryWindow> };
const memoryWindows = (globalStore.__rateLimits ??= new Map<string, MemoryWindow>());

function consumeInMemory(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  // تنظيف كسول حتى لا تنمو الخريطة بلا حدود
  if (memoryWindows.size > 5000) {
    for (const [k, w] of memoryWindows) {
      if (now - w.windowStart > windowMs) memoryWindows.delete(k);
    }
  }
  const entry = memoryWindows.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    memoryWindows.set(key, { windowStart: now, count: 1 });
    return limit >= 1;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** يستهلك محاولة من النافذة ويعيد هل ما زالت مسموحة */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (!error) return !!data;
    // تعذر مؤقت في القاعدة: نسمح مع التسجيل كي لا يتعطل المنتج (fail-open)
    console.error("consume_rate_limit RPC failed:", error.message);
  }
  return consumeInMemory(key, limit, windowSeconds);
}

/** معرّف الزائر — عنوان IP كما يمرره Vercel */
export function visitorIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

/** مفتاح التحديد: بالمستخدم إن كان مسجلاً وإلا بعنوان IP */
export function rateLimitKey(scope: LimitScope, userId: string | null, ip: string): string {
  return userId ? `${scope}:user:${userId}` : `${scope}:ip:${ip}`;
}

/** حد النطاق حسب حالة التسجيل */
export function rateLimitFor(scope: LimitScope, signedIn: boolean): number {
  return signedIn ? LIMITS[scope].perVisitor * SIGNED_IN_MULTIPLIER : LIMITS[scope].perVisitor;
}

export type LimitVerdict = { allowed: boolean; message: string; status?: number };

/**
 * فحص واستهلاك طلب واحد: أمر المالك أولاً، ثم السقف العام، ثم حد الزائر/المستخدم.
 * تحديث لقطة الإعدادات هنا يجعلها جاهزة لبقية الطلب (اختيار المزوّد مثلاً).
 */
export async function checkLimit(
  req: Request,
  scope: LimitScope,
  userId: string | null = null
): Promise<LimitVerdict> {
  const rule = LIMITS[scope];

  const gate = gateFor(await getPlatformSettings(), scope);
  if (gate.blocked) {
    return { allowed: false, message: gate.message, status: 503 };
  }

  const globalOk = await consumeRateLimit(`${scope}:global`, rule.global, rule.windowSec);
  if (!globalOk) {
    return { allowed: false, message: "المنصة تستقبل عدداً كبيراً من الطلبات الآن — جرّب بعد قليل" };
  }

  const ok = await consumeRateLimit(
    rateLimitKey(scope, userId, visitorIp(req)),
    rateLimitFor(scope, !!userId),
    rule.windowSec
  );
  if (!ok) {
    return {
      allowed: false,
      message:
        "تجاوزت الحد المسموح من الطلبات مؤقتاً — حاول بعد قليل" +
        (userId ? "" : "، أو سجّل الدخول لحدود أعلى"),
    };
  }

  // نظام الرصيد: المسجل يخصم من باقته الشهرية حسب كلفة المسار
  if (userId) {
    const credit = await consumeCredits(userId, scope);
    if (!credit.allowed) {
      return {
        allowed: false,
        message:
          "انتهى رصيدك الشهري من النقاط — يتجدد تلقائياً مطلع كل شهر، أو راسل الدعم لرفع باقتك",
        status: 402,
      };
    }
  }

  return { allowed: true, message: "" };
}

/** استجابة الرفض الموحّدة — 429 لتجاوز الحد و503 لإيقاف من المالك */
export function limitResponse(verdict: LimitVerdict): Response {
  return new Response(JSON.stringify({ error: verdict.message }), {
    status: verdict.status ?? 429,
    headers: { "Content-Type": "application/json" },
  });
}
