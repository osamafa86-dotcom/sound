import { describe, expect, it } from "vitest";
import {
  levenshtein,
  normalizeArabic,
  pronunciationAccuracy,
  replaceWholeWord,
} from "@/lib/textCompare";

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

describe("استبدال الكلمة الكاملة (تصحيح النطق)", () => {
  it("يصيب الكلمة المستقلة فقط — لا أجزاء الكلمات ولا الملتصقة بسابقة عطف", () => {
    // «منها» و«زمن» و«ومن» تبقى — القاعدة صارمة عمداً: من أراد «ومن» يعلّمها كلمة مستقلة
    expect(replaceWholeWord("من زمن بعيد جئنا منها ومن هنا، من قال؟", "من", "مِنْ")).toBe(
      "مِنْ زمن بعيد جئنا منها ومن هنا، مِنْ قال؟"
    );
  });

  it("يعمل في أول النص وآخره وبجوار الترقيم وعبر الأسطر", () => {
    expect(replaceWholeWord("حب، وكل الحب أحبك\nحب", "حب", "حُب")).toBe(
      "حُب، وكل الحب أحبك\nحُب"
    );
  });

  it("ظهورات متتالية تُستبدل كلها والبديل بعلامة $ لا يُفسَّر", () => {
    expect(replaceWholeWord("يا يا يا", "يا", "يَا")).toBe("يَا يَا يَا");
    expect(replaceWholeWord("سعر", "سعر", "$&x")).toBe("$&x");
  });

  it("كلمة فارغة أو غائبة تعيد النص كما هو", () => {
    expect(replaceWholeWord("نص ثابت", "", "بديل")).toBe("نص ثابت");
    expect(replaceWholeWord("نص ثابت", "غائبة", "بديل")).toBe("نص ثابت");
  });
});
