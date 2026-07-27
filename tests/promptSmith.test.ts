import { describe, expect, it } from "vitest";
import { PROMPT_TYPES } from "@/lib/promptSmith";

describe("مهندس البرومبتات", () => {
  it("ثمانية اختصاصات بمعرّفات فريدة", () => {
    expect(PROMPT_TYPES).toHaveLength(8);
    const ids = PROMPT_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("كل اختصاص كامل العدّة: منصات وعدّة خبير غنية ولغة رئيسة", () => {
    for (const t of PROMPT_TYPES) {
      expect(t.platforms.length).toBeGreaterThan(0);
      expect(t.expertise.length).toBeGreaterThan(100);
      expect(["ar", "en"]).toContain(t.primaryLang);
    }
  });

  it("الصورة والفيديو والأغنية إنجليزية المخرج، والنصوص العربية عربية", () => {
    const lang = (id: string) => PROMPT_TYPES.find((t) => t.id === id)?.primaryLang;
    expect(lang("image")).toBe("en");
    expect(lang("video")).toBe("en");
    expect(lang("song")).toBe("en");
    expect(lang("news")).toBe("ar");
    expect(lang("podcast")).toBe("ar");
    expect(lang("voiceover")).toBe("ar");
  });

  it("عدّة الخبراء تذكر أدوات الحرفة الفعلية", () => {
    const find = (id: string) => PROMPT_TYPES.find((t) => t.id === id)!.expertise;
    expect(find("news")).toContain("الهرم المقلوب");
    expect(find("image")).toMatch(/lighting/i);
    expect(find("video")).toMatch(/camera/i);
    expect(find("song")).toMatch(/maqam/i);
    expect(find("ad")).toContain("٣ ثوانٍ");
  });
});
