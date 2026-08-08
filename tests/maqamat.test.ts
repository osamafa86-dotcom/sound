import { describe, expect, it } from "vitest";
import { DIALECTS, INSTRUMENTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";

describe("بيانات المقامات", () => {
  it("المعرّفات فريدة", () => {
    const ids = MAQAMAT.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("كل مقام يحمل سلّماً تصاعدياً يبدأ من الأساس وينتهي بالجواب", () => {
    for (const m of MAQAMAT) {
      // السباعية 8 درجات؛ البلوز 7 والخماسي 6 — كلها سلالم مشروعة للمولّد
      expect(m.scale.length).toBeGreaterThanOrEqual(6);
      expect(m.scale.length).toBeLessThanOrEqual(8);
      expect(m.scale[0]).toBe(0);
      expect(m.scale[m.scale.length - 1]).toBe(12);
      for (let i = 1; i < m.scale.length; i++) {
        expect(m.scale[i]).toBeGreaterThan(m.scale[i - 1]);
      }
    }
  });

  it("العائلات الثلاث ممثلة بغنى — عربية وتركية وغربية", () => {
    for (const family of ["arabic", "turkish", "western"] as const) {
      expect(MAQAMAT.filter((m) => m.family === family).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("السلالم الغربية بلا أرباع نغمات — أنصاف صحيحة فقط", () => {
    for (const m of MAQAMAT.filter((x) => x.family === "western")) {
      expect(m.scale.every((deg) => Number.isInteger(deg))).toBe(true);
    }
  });

  it("ألوان الغناء الجديدة حاضرة بمعرّفاتها", () => {
    for (const id of ["ritha", "shajan", "atab", "haneen", "ibtihal", "afrah"]) {
      expect(SONG_STYLES.some((s) => s.id === id)).toBe(true);
    }
  });

  it("كل مقام يحمل برومبت أسلوب إنجليزياً غير فارغ", () => {
    for (const m of MAQAMAT) {
      expect(m.stylePrompt.length).toBeGreaterThan(10);
    }
  });

  it("المقامات الربعية تحتوي أرباع نغمات فعلاً", () => {
    const quarterToneMaqams = ["bayati", "rast", "saba", "sikah"];
    for (const id of quarterToneMaqams) {
      const m = MAQAMAT.find((x) => x.id === id)!;
      expect(m.scale.some((deg) => deg % 1 !== 0)).toBe(true);
    }
  });

  it("كل مقام بأرباع نغمات يصرّح بها في برومبته الموسيقي", () => {
    for (const m of MAQAMAT) {
      if (m.scale.some((deg) => deg % 1 !== 0)) {
        expect(m.stylePrompt.toLowerCase()).toMatch(/quarter|half-flat/);
      }
    }
  });

  it("معرّفات الأساليب واللهجات والآلات فريدة", () => {
    for (const list of [SONG_STYLES, DIALECTS, INSTRUMENTS] as const) {
      const ids = list.map((x) => x.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
