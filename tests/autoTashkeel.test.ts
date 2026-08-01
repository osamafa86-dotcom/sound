import { describe, expect, it } from "vitest";
import { enforceLetterSkeleton, letterSkeleton, needsTashkeel } from "@/lib/lyricsProofread";

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
