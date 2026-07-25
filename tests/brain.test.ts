import { describe, expect, it } from "vitest";
import { getPromptExemplars, getVoiceScores, getVoiceTuning } from "@/lib/brain";

// بيئة الاختبار بلا Supabase → التدهور الآمن: إشارات فارغة بدل الأخطاء

describe("عقل المنصة (التدهور الآمن بلا Supabase)", () => {
  it("درجات الأصوات خريطة فارغة", async () => {
    const scores = await getVoiceScores();
    expect(scores.size).toBe(0);
  });

  it("الإعدادات المتعلمة خريطة فارغة", async () => {
    const tuning = await getVoiceTuning();
    expect(tuning.size).toBe(0);
  });

  it("أمثلة البرومبتات قائمة فارغة", async () => {
    const exemplars = await getPromptExemplars();
    expect(exemplars).toEqual([]);
  });
});
