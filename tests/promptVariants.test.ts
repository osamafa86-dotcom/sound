import { describe, expect, it } from "vitest";
import { signalContribution, variantAvg } from "@/lib/promptVariants";
import { pickMaqamPrompt } from "@/lib/promptVariants";
import { MAQAMAT } from "@/lib/maqamat";

describe("سلالات البرومبتات", () => {
  it("متوسط السلالة: المجهولة تبدأ حيادية 0.5", () => {
    expect(variantAvg({ score_sum: 0, score_count: 0 })).toBe(0.5);
    expect(variantAvg({ score_sum: 4.5, score_count: 5 })).toBe(0.9);
  });

  it("إسهام الإشارات: مشاركة (+3) قرب القمة وإعادة مقطع (-1) تحت الوسط", () => {
    expect(signalContribution(3)).toBe(1);
    expect(signalContribution(2.5)).toBeCloseTo(0.917, 2);
    expect(signalContribution(-1)).toBeCloseTo(0.333, 2);
    expect(signalContribution(-3)).toBe(0);
  });

  it("بلا Supabase: يعود برومبت الكود بلا معرّف سلالة", async () => {
    const maqam = MAQAMAT[0];
    const picked = await pickMaqamPrompt(maqam.id);
    expect(picked.prompt).toBe(maqam.stylePrompt);
    expect(picked.variantId).toBeUndefined();
  });
});
