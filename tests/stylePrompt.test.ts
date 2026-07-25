import { describe, expect, it } from "vitest";
import { MAQAMAT } from "@/lib/maqamat";
import { buildStylePrompt } from "@/lib/stylePrompt";

const maqam = MAQAMAT[0];

describe("بناء البرومبت الموسيقي", () => {
  it("التركيب المحلي: مقام + أسلوب + آلات + جودة", () => {
    const prompt = buildStylePrompt({
      maqam,
      styleEn: "classical Arabic tarab",
      instrumentsEn: ["oud", "nay flute"],
    });
    expect(prompt).toContain(maqam.stylePrompt);
    expect(prompt).toContain("classical Arabic tarab");
    expect(prompt).toContain("oud, nay flute");
    expect(prompt).toContain("high quality studio production");
  });

  it("برومبت Claude يحل محل التركيب المحلي مع إبقاء الآلات", () => {
    const prompt = buildStylePrompt({
      maqam,
      styleEn: "classical Arabic tarab",
      instrumentsEn: ["qanun"],
      aiStylePrompt: "Arabic maqam Hijaz taqsim, 70 BPM",
    });
    expect(prompt).toContain("Arabic maqam Hijaz taqsim, 70 BPM");
    expect(prompt).not.toContain(maqam.stylePrompt);
    expect(prompt).toContain("qanun");
  });

  it("برومبت الذكاء الاصطناعي يُقصّ عند 700 حرف", () => {
    const prompt = buildStylePrompt({
      maqam,
      styleEn: "x",
      instrumentsEn: [],
      aiStylePrompt: "a".repeat(2000),
    });
    expect(prompt.length).toBeLessThan(800);
  });

  it("بدون آلات: لا فواصل فارغة", () => {
    const prompt = buildStylePrompt({ maqam, styleEn: "pop", instrumentsEn: [] });
    expect(prompt).not.toContain(", ,");
  });
});
