import { describe, expect, it } from "vitest";
import { SONG_STYLES } from "@/lib/maqamat";
import { MAQAMAT } from "@/lib/maqamat";
import {
  HERITAGE_STYLE_IDS,
  PALESTINIAN_STYLES,
  heritageAssistBlock,
  heritageDeliveryEn,
  heritageStyle,
} from "@/lib/heritage/palestinian";

describe("ذاكرة التراث الغنائي الفلسطيني", () => {
  it("كل قالب تراثي له أسلوب مطابق في كتالوج الأساليب", () => {
    for (const style of PALESTINIAN_STYLES) {
      expect(SONG_STYLES.some((s) => s.id === style.id)).toBe(true);
    }
  });

  it("مقامات كل قالب موجودة فعلاً في قائمة المقامات", () => {
    for (const style of PALESTINIAN_STYLES) {
      expect(style.maqamIds.length).toBeGreaterThan(0);
      for (const id of style.maqamIds) {
        expect(MAQAMAT.some((m) => m.id === id)).toBe(true);
      }
    }
  });

  it("الحمض الموسيقي غني: يذكر الإيقاع والآلات التراثية", () => {
    const dal3ona = heritageStyle("dal3ona")!;
    expect(dal3ona.dna).toMatch(/dabke/i);
    expect(dal3ona.dna).toMatch(/mijwiz|yarghul/i);
    const ataba = heritageStyle("ataba")!;
    expect(ataba.dna).toMatch(/mawwal|jinas/i);
  });

  it("كتلة المساعد: بنية القالب + المعجم عند السياق الفلسطيني فقط", () => {
    const full = heritageAssistBlock("palestinian", "dal3ona");
    expect(full).toContain("ع الدلعونا");
    expect(full).toContain("يمّا");
    expect(heritageAssistBlock("egyptian", "pop")).toBe("");
    // قالب تراثي بلهجة أخرى: البنية تحضر بلا معجم اللهجة
    expect(heritageAssistBlock("fusha", "ataba")).toContain("ميجانا");
  });

  it("توجيه الأداء: فلاحي للقوالب التراثية وعام لغيرها", () => {
    expect(heritageDeliveryEn("palestinian", "dabke")).toMatch(/fallahi/);
    expect(heritageDeliveryEn("palestinian", "pop")).toMatch(/Palestinian/);
    expect(heritageDeliveryEn("palestinian", "pop")).not.toMatch(/fallahi/);
    expect(heritageDeliveryEn("egyptian", "dabke")).toBe("");
  });

  it("معرّفات القوالب التراثية متسقة", () => {
    expect(HERITAGE_STYLE_IDS).toHaveLength(5);
    expect(HERITAGE_STYLE_IDS).toContain("dal3ona");
  });
});
