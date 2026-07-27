import { describe, expect, it } from "vitest";
import { CREDIT_COSTS, FREE_MONTHLY_CREDITS } from "@/lib/credits";
import { LIMITS } from "@/lib/rateLimit";

describe("نظام الرصيد", () => {
  it("كل مسار مسعّر موجود فعلاً في حدود الاستهلاك", () => {
    for (const scope of Object.keys(CREDIT_COSTS)) {
      expect(LIMITS, `scope ${scope}`).toHaveProperty(scope);
    }
  });

  it("التكاليف أعداد صحيحة موجبة", () => {
    for (const [scope, cost] of Object.entries(CREDIT_COSTS)) {
      expect(Number.isInteger(cost), `${scope} = ${cost}`).toBe(true);
      expect(cost).toBeGreaterThan(0);
    }
  });

  it("الباقة الشهرية تغطي استخداماً شهرياً معقولاً", () => {
    // على الأقل: 100 توليد صوتي، أو 20 أغنية — الباقة المجانية سخية بما يكفي للتجربة الجادة
    expect(FREE_MONTHLY_CREDITS).toBeGreaterThanOrEqual((CREDIT_COSTS.tts ?? 0) * 100);
    expect(FREE_MONTHLY_CREDITS).toBeGreaterThanOrEqual((CREDIT_COSTS.songs ?? 0) * 20);
  });

  it("الأغنية أغلى من الصوت — الترتيب يعكس الكلفة الحقيقية", () => {
    expect(CREDIT_COSTS.songs!).toBeGreaterThan(CREDIT_COSTS.tts!);
    expect(CREDIT_COSTS.voiceClone!).toBeGreaterThan(CREDIT_COSTS.tts!);
  });
});
