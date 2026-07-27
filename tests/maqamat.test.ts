import { describe, expect, it } from "vitest";
import { DIALECTS, INSTRUMENTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";

describe("بيانات المقامات", () => {
  it("المعرّفات فريدة", () => {
    const ids = MAQAMAT.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("كل مقام يحمل سلّماً من 8 درجات يبدأ من الأساس وينتهي بالجواب", () => {
    for (const m of MAQAMAT) {
      expect(m.scale).toHaveLength(8);
      expect(m.scale[0]).toBe(0);
      expect(m.scale[7]).toBe(12);
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
