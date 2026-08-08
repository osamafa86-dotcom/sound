import { describe, expect, it } from "vitest";
import { MAQAMAT } from "@/lib/maqamat";
import { buildStylePrompt , defuseStylePrompt } from "@/lib/stylePrompt";

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

  it("«نسخة أخرى»: رقم النسخة يضيف توجيه التنويع", () => {
    const base = buildStylePrompt({ maqam, styleEn: "pop", instrumentsEn: ["oud"] });
    const alt = buildStylePrompt({ maqam, styleEn: "pop", instrumentsEn: ["oud"], variation: 1 });
    expect(base).not.toContain("alternate take");
    expect(alt).toContain("alternate take 2");
    expect(alt).toContain("same maqam and mood");
  });
});

describe("تحييد برومبت الأسلوب لمرشّح ليرا المتقلب", () => {
  it("يستبدل الموصوفات الحماسية بمرادفات مهرجانية ويمحو العسكرية", () => {
    const defused = defuseStylePrompt(
      "Palestinian patriotic anthem, defiant martial drums, war themes, festive full arrangement"
    );
    expect(defused).toContain("celebratory folk chorus");
    expect(defused).toContain("resolute");
    expect(defused).toContain("festive full arrangement");
    expect(defused).not.toMatch(/patriotic|anthem|martial|war\b|defiant/i);
  });

  it("برومبت هادئ يمر كما هو تقريباً", () => {
    const calm = "Arabic maqam Bayati, warm intimate folk tarab, oud and nay";
    expect(defuseStylePrompt(calm)).toBe(calm);
  });
});
