import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * تحديد معدل الاستخدام (نافذة ثابتة) — حماية أساسية لمفاتيح التوليد المدفوعة.
 * على الإنتاج يعتمد دالة SQL ذرّية في Supabase (النسخ Serverless لا تتشارك ذاكرة)،
 * وفي التطوير أو عند تعذر القاعدة يعمل عدّاد محلي في الذاكرة.
 */

function envInt(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** الحدود لكل ساعة لغير المسجلين — المسجلون يحصلون على أضعافها */
export const RATE_LIMITS = {
  tts: envInt("RATE_LIMIT_TTS", 10),
  songs: envInt("RATE_LIMIT_SONGS", 6),
  lyrics: envInt("RATE_LIMIT_LYRICS", 12),
  stt: envInt("RATE_LIMIT_STT", 8),
  sts: envInt("RATE_LIMIT_STS", 6),
  clone: envInt("RATE_LIMIT_CLONE", 2),
} as const;

/** مضاعف حدود المستخدمين المسجلين */
export const SIGNED_IN_MULTIPLIER = envInt("RATE_LIMIT_SIGNED_IN_MULTIPLIER", 3);

export const WINDOW_SECONDS = 3600;

type MemoryWindow = { windowStart: number; count: number };
const globalStore = globalThis as unknown as { __rateLimits?: Map<string, MemoryWindow> };
const memoryWindows = (globalStore.__rateLimits ??= new Map<string, MemoryWindow>());

function consumeInMemory(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = memoryWindows.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    memoryWindows.set(key, { windowStart: now, count: 1 });
    return limit >= 1;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/** يستهلك محاولة من النافذة ويعيد هل ما زالت مسموحة */
export async function consumeRateLimit(
  key: string,
  limit: number,
  windowSeconds: number = WINDOW_SECONDS
): Promise<boolean> {
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

/** مفتاح التحديد: بالمستخدم إن كان مسجلاً وإلا بعنوان IP */
export function rateLimitKey(scope: keyof typeof RATE_LIMITS, userId: string | null, ip: string): string {
  return userId ? `${scope}:user:${userId}` : `${scope}:ip:${ip}`;
}

/** حد النطاق حسب حالة التسجيل */
export function rateLimitFor(scope: keyof typeof RATE_LIMITS, signedIn: boolean): number {
  return signedIn ? RATE_LIMITS[scope] * SIGNED_IN_MULTIPLIER : RATE_LIMITS[scope];
}
