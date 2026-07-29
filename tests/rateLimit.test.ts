import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeRateLimit, rateLimitFor, rateLimitKey, LIMITS, SIGNED_IN_MULTIPLIER } from "@/lib/rateLimit";

// بيئة الاختبار بلا Supabase → يعمل عدّاد الذاكرة

describe("تحديد معدل الاستخدام (عدّاد الذاكرة)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("يسمح حتى الحد ثم يمنع", async () => {
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      expect(await consumeRateLimit(key, 3, 60)).toBe(true);
    }
    expect(await consumeRateLimit(key, 3, 60)).toBe(false);
  });

  it("النافذة تُعاد بعد انقضاء مدتها", async () => {
    const key = `test:${Math.random()}`;
    expect(await consumeRateLimit(key, 1, 60)).toBe(true);
    expect(await consumeRateLimit(key, 1, 60)).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(await consumeRateLimit(key, 1, 60)).toBe(true);
  });

  it("مفاتيح التحديد تفصل المستخدم عن عنوان IP", () => {
    expect(rateLimitKey("tts", "u1", "1.2.3.4")).toBe("tts:user:u1");
    expect(rateLimitKey("tts", null, "1.2.3.4")).toBe("tts:ip:1.2.3.4");
  });

  it("المسجلون يحصلون على حدود مضاعفة", () => {
    expect(rateLimitFor("songs", true)).toBe(LIMITS.songs.perVisitor * SIGNED_IN_MULTIPLIER);
    expect(rateLimitFor("songs", false)).toBe(LIMITS.songs.perVisitor);
  });
});

describe("صلاحيات الأعضاء", () => {
  it("كل نطاقات الصوت محجوزة للأعضاء — والتصفح والمساعدات النصية مفتوحة", async () => {
    const { LIMITS, MEMBER_ONLY_SCOPES } = await import("@/lib/rateLimit");
    // كل نطاق محجوز موجود فعلاً في الحدود
    for (const scope of MEMBER_ONLY_SCOPES) {
      expect(LIMITS).toHaveProperty(scope);
    }
    // الصوتية كلها محجوزة
    for (const scope of ["tts", "songs", "stt", "sts", "isolate", "voiceClone", "voiceDesign", "drama"] as const) {
      expect(MEMBER_ONLY_SCOPES.has(scope), `${scope} يجب أن يكون للأعضاء`).toBe(true);
    }
    // التصفح يبقى حراً: عينات المعرض والمساعدات النصية
    for (const scope of ["sample", "lyrics", "enhance", "prompts", "support", "signals"] as const) {
      expect(MEMBER_ONLY_SCOPES.has(scope), `${scope} يجب أن يبقى مفتوحاً`).toBe(false);
    }
  });
});
