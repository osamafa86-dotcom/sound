import { describe, expect, it } from "vitest";
import { needsTashkeel } from "@/lib/lyricsProofread";

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
