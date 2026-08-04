import { describe, expect, it } from "vitest";
import {
  LIVE_BPM_MAX,
  LIVE_BPM_MIN,
  buildMusicConfig,
  buildWeightedPrompts,
  clampBpm,
  pcm16ChunkToStereo,
} from "@/lib/liveMaqam";

const MAQAM = { stylePrompt: "Arabic maqam bayati, oud and qanun, emotional taqsim" };

describe("ضبط إيقاع الجلسة الحية", () => {
  it("يبقي القيم داخل المدى ويقرّب الكسور", () => {
    expect(clampBpm(90.4)).toBe(90);
    expect(clampBpm(LIVE_BPM_MIN - 50)).toBe(LIVE_BPM_MIN);
    expect(clampBpm(LIVE_BPM_MAX + 50)).toBe(LIVE_BPM_MAX);
  });

  it("يرجع الافتراضي عند قيمة غير صالحة", () => {
    expect(clampBpm(NaN)).toBe(90);
    expect(clampBpm(Infinity)).toBe(90);
  });
});

describe("البرومبتات الموزونة", () => {
  it("هوية المقام دائماً أولى وبوزن كامل", () => {
    const prompts = buildWeightedPrompts(MAQAM, { bpm: 90, intensity: 0.5 });
    expect(prompts[0]).toEqual({ text: MAQAM.stylePrompt, weight: 1 });
  });

  it("الحيوية القصوى تُسقط قطب الهدوء، والدنيا تُسقط قطب الطاقة", () => {
    const energetic = buildWeightedPrompts(MAQAM, { bpm: 120, intensity: 1 });
    expect(energetic.some((p) => p.text.includes("calm"))).toBe(false);
    expect(energetic.some((p) => p.text.includes("energetic"))).toBe(true);

    const calm = buildWeightedPrompts(MAQAM, { bpm: 70, intensity: 0 });
    expect(calm.some((p) => p.text.includes("energetic"))).toBe(false);
    expect(calm.some((p) => p.text.includes("calm"))).toBe(true);
  });

  it("الحيوية الوسطى توازن القطبين بوزنين متكاملين", () => {
    const prompts = buildWeightedPrompts(MAQAM, { bpm: 90, intensity: 0.3 });
    const energy = prompts.find((p) => p.text.includes("energetic"));
    const calm = prompts.find((p) => p.text.includes("calm"));
    expect(energy?.weight).toBeCloseTo(0.3);
    expect(calm?.weight).toBeCloseTo(0.7);
  });

  it("الآلات المختارة تدخل ببرومبت واحد بحد ست آلات", () => {
    const prompts = buildWeightedPrompts(MAQAM, {
      bpm: 90,
      intensity: 0.5,
      instrumentsEn: ["oud", "qanun", "nay", "violin", "riq", "tabla", "buzuq", "cello"],
    });
    const inst = prompts.find((p) => p.text.startsWith("oud"));
    expect(inst?.text.split(", ")).toHaveLength(6);
    expect(inst?.text).not.toContain("buzuq");
  });

  it("حيوية خارجة عن المدى تُطبَّع بدل أن تكسر الأوزان", () => {
    const prompts = buildWeightedPrompts(MAQAM, { bpm: 90, intensity: 7 });
    for (const p of prompts) {
      expect(p.weight).toBeGreaterThan(0);
      expect(p.weight).toBeLessThanOrEqual(1);
    }
  });
});

describe("إعدادات التوليد الحية", () => {
  it("تحصر الإيقاع والكثافة والسطوع ضمن مدى الواجهة", () => {
    const config = buildMusicConfig({ bpm: 500, intensity: 1 });
    expect(config.bpm).toBe(LIVE_BPM_MAX);
    expect(config.density).toBe(1);
    expect(config.brightness).toBeCloseTo(0.8);
  });

  it("الهدوء التام يعطي كثافة صفرية وسطوعاً خافتاً", () => {
    const config = buildMusicConfig({ bpm: 80, intensity: 0 });
    expect(config.density).toBe(0);
    expect(config.brightness).toBeCloseTo(0.35);
  });
});

describe("تحويل PCM16 المتشابك إلى قناتين", () => {
  it("يفصل اليسار عن اليمين ويطبّع إلى [-1, 1]", () => {
    // إطاران: (16384, -16384) ثم (32767, 0)
    const samples = new Int16Array([16384, -16384, 32767, 0]);
    const { left, right } = pcm16ChunkToStereo(new Uint8Array(samples.buffer));
    expect(left).toHaveLength(2);
    expect(right).toHaveLength(2);
    expect(left[0]).toBeCloseTo(0.5);
    expect(right[0]).toBeCloseTo(-0.5);
    expect(left[1]).toBeCloseTo(1, 3);
    expect(right[1]).toBe(0);
  });

  it("يتجاهل البايت الزائد عن حدود العينات دون كسر", () => {
    const bytes = new Uint8Array([0, 64, 0, 192, 7]); // عينتان ونصف بايت زائد
    const { left, right } = pcm16ChunkToStereo(bytes);
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(1);
  });

  it("قطعة فارغة ترجع قناتين فارغتين", () => {
    const { left, right } = pcm16ChunkToStereo(new Uint8Array(0));
    expect(left).toHaveLength(0);
    expect(right).toHaveLength(0);
  });
});
