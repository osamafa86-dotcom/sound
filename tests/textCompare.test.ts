import { describe, expect, it } from "vitest";
import { levenshtein, normalizeArabic, pronunciationAccuracy } from "@/lib/textCompare";

describe("مقياس دقة النطق", () => {
  it("التطبيع يسقط التشكيل ورسم الهمزات والترقيم", () => {
    expect(normalizeArabic("أَهْلاً وَسَهْلاً!")).toBe("اهلا وسهلا");
    expect(normalizeArabic("إلى المدرسةِ.")).toBe("الي المدرسه");
    expect(normalizeArabic("قُرْآن")).toBe("قران");
  });

  it("مسافة Levenshtein أساسية", () => {
    expect(levenshtein("كتاب", "كتاب")).toBe(0);
    expect(levenshtein("كتاب", "كتب")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
  });

  it("تطابق تام بعد التطبيع = دقة كاملة", () => {
    expect(pronunciationAccuracy("مَرْحَباً بِكُم", "مرحبا بكم")).toBe(1);
  });

  it("أخطاء جزئية تخفض الدقة دون إلغائها", () => {
    const score = pronunciationAccuracy("السلام عليكم ورحمة الله", "السلام عليكم ورحمه الله");
    expect(score).toBe(1); // ة/ه لا تعد خطأ نطق
    const worse = pronunciationAccuracy("السلام عليكم", "السلام معليكو");
    expect(worse).toBeLessThan(1);
    expect(worse).toBeGreaterThan(0.5);
  });

  it("نص فارغ بعد التطبيع → لا حكم", () => {
    expect(pronunciationAccuracy("!!!", "أي شيء")).toBeNull();
  });
});
