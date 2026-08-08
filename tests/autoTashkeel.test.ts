import { describe, expect, it } from "vitest";
import {
  DELIBERATE_TASHKEEL_DENSITY,
  completeFunctionWords,
  enforceLetterSkeleton,
  letterSkeleton,
  needsTashkeel,
  vocalizationDensity,
} from "@/lib/lyricsProofread";

describe("كاشف الحاجة للتشكيل", () => {
  it("نص عربي طويل عارٍ من الحركات ⟵ يحتاج تشكيلاً", () => {
    expect(
      needsTashkeel("يا ليل يا عين وقلبي حزين على فراق الحبايب والدار بعيد والشوق يزيد")
    ).toBe(true);
  });

  it("نص مشكّل تشكيلاً تاماً ⟵ يمر بلا إعادة تشكيل", () => {
    expect(
      needsTashkeel("يَا لَيْلُ يَا عَيْنُ وَقَلْبِي حَزِينٌ عَلَى فِرَاقِ الحَبَايِبِ وَالدَّارُ بَعِيدَة")
    ).toBe(false);
  });

  it("نص قصير جداً أو غير عربي ⟵ لا يستدعي مدققاً", () => {
    expect(needsTashkeel("يا ليل")).toBe(false);
    expect(needsTashkeel("Hello world this is an English only line of text")).toBe(false);
  });
});

describe("حارس قدسية الحروف (المدقق يشكّل ولا يبدّل)", () => {
  it("الهيكل الحرفي يسقط الحركات والتطويل ويوحّد المسافات", () => {
    expect(letterSkeleton("يَا طَيْرْ  طَايِرْ")).toBe("يا طير طاير");
  });

  it("تشكيل سليم الهيكل يُعتمد كاملاً", () => {
    const original = "يا طير طاير ع البلاد البعيدة";
    const proofed = "يَا طَيْرْ طَايِرْ عَ الْبِلَادْ الْبَعِيدَة";
    expect(enforceLetterSkeleton(original, proofed)).toBe(proofed);
  });

  it("كلمة بدّل المدقق حروفها تعود لأصلها وتُقبل جاراتها المشكّلة سليمة", () => {
    const original = "يا طير طاير ع البلاد";
    // النموذج «كتب كما تُنطق»: طير⟵ظير، البلاد⟵البلاذ — تشويه مرفوض
    const proofed = "يَا ظَيْرْ طَايِرْ عَ الْبَلَاذْ";
    expect(enforceLetterSkeleton(original, proofed)).toBe("يَا طير طَايِرْ عَ البلاد");
  });

  it("اختلاف عدد أسطر أو كلمات السطر ⟵ يبقى الأصل", () => {
    expect(enforceLetterSkeleton("سطر واحد", "سَطْرْ\nسَطْرَانْ")).toBe("سطر واحد");
    expect(enforceLetterSkeleton("قول لها يا طير", "قُولْلهَا يَا طَيْر")).toBe("قول لها يا طير");
  });
});

describe("بوابة الكثافة الذكية — المشكّل عمداً لا يُعاد تلقينه", () => {
  it("النص العاري كثافته صفرية والمشكّل كاملاً يتجاوز العتبة", () => {
    expect(vocalizationDensity("يا ليل يا عين وقلبي حزين")).toBe(0);
    expect(
      vocalizationDensity("يَا لَيْلُ يَا عَيْنُ وَقَلْبِي حَزِينٌ عَلَى فِرَاقِ الحَبَايِبِ")
    ).toBeGreaterThan(DELIBERATE_TASHKEEL_DENSITY);
  });

  it("المشكّل جزئياً يبقى تحت العتبة فيلتقطه الملقّن", () => {
    const partial = "يَا ليل يا عين وقلبي حزين على فراق الحبايب والدار بعيدة والشوق يزيد";
    const d = vocalizationDensity(partial);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(DELIBERATE_TASHKEEL_DENSITY);
  });

  it("نص بلا حروف عربية ⟵ صفر بلا قسمة على صفر", () => {
    expect(vocalizationDensity("Hello 123")).toBe(0);
  });
});

describe("الإكمال الحتمي للكلمات الوظيفية عارية النهاية", () => {
  it("«بِه» العارية النهاية تكتمل «بِهِ» — والمشكّلة نهايتها لا تُمس", () => {
    expect(completeFunctionWords("شَيْخْ بِه رُوحُ النُّبُوَّة")).toBe(
      "شَيْخْ بِهِ رُوحُ النُّبُوَّة"
    );
    expect(completeFunctionWords("به روح")).toBe("بِهِ روح");
    // نهاية محرّكة أو مسكّنة وقفاً = اختيار متعمد يُحترم
    expect(completeFunctionWords("قال بِهْ وسكت")).toBe("قال بِهْ وسكت");
    expect(completeFunctionWords("آمنتُ بِهِ حقاً")).toBe("آمنتُ بِهِ حقاً");
  });

  it("يشمل القاموس فيه وله وعليه — وما سواها لا يُمس", () => {
    expect(completeFunctionWords("فيه خير له وعليه سلام")).toBe(
      "فِيهِ خير لَهُ وعَلَيْهِ سلام"
    );
    expect(completeFunctionWords("بهر الحاضرين")).toBe("بهر الحاضرين"); // كلمة أخرى
  });
});
