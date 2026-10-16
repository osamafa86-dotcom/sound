import { describe, expect, it, vi } from "vitest";
import {
  elevenMusicModel,
  isTagGeneration,
  snapStabilityV3,
  voiceSettingsFor,
} from "@/lib/providers/elevenlabs";
import type { TTSRequest } from "@/lib/providers/types";

/**
 * إعدادات الصوت حسب جيل المحرك: الجيل الثالث مقيّد بثلاث درجات ثبات
 * بلا سرعة أو تعبير، والجيلان الثاني والرابع يقبلان الطيف الكامل
 * (ثُبت للرابع عملياً على الـAPI).
 */

const req = {
  text: "مرحباً",
  voiceId: "v",
  stability: 0.42,
  speed: 1.4,
  liveliness: 0.8,
  speakerBoost: false,
} as TTSRequest;

describe("إعدادات الصوت حسب الجيل", () => {
  it("الجيل الثالث: ثبات مثبّت على الدرجات الثلاث بلا سرعة أو تعبير", () => {
    const s = voiceSettingsFor("eleven_v3", req);
    expect(s.stability).toBe(0.5);
    expect(s.speed).toBeUndefined();
    expect(s.style).toBeUndefined();
    expect(s.use_speaker_boost).toBe(true);
  });

  it("الجيل الرابع: الطيف الكامل مع قصّ السرعة لنطاق المحرك", () => {
    const s = voiceSettingsFor("eleven_v4", req);
    expect(s.stability).toBe(0.42);
    expect(s.speed).toBe(1.2);
    expect(s.style).toBe(0.8);
    expect(s.use_speaker_boost).toBe(false);
  });

  it("snapStabilityV3 يثبّت على الدرجات الثلاث", () => {
    expect(snapStabilityV3(0.1)).toBe(0);
    expect(snapStabilityV3(0.6)).toBe(0.5);
    expect(snapStabilityV3(0.9)).toBe(1);
  });
});

describe("نموذج النطق لكل مسار", () => {
  it("المساران الكلاسيكي والتعبيري على الجيل الرابع افتراضياً", async () => {
    vi.resetModules();
    const { elevenTTSModel } = await import("@/lib/providers/elevenlabs");
    expect(elevenTTSModel(false)).toBe("eleven_v4");
    expect(elevenTTSModel(true)).toBe("eleven_v4");
  });

  it("ELEVENLABS_MODEL_ID يعيد الكلاسيكي وحده للجيل الثاني", async () => {
    vi.resetModules();
    vi.stubEnv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2");
    const { elevenTTSModel } = await import("@/lib/providers/elevenlabs");
    expect(elevenTTSModel(false)).toBe("eleven_multilingual_v2");
    expect(elevenTTSModel(true)).toBe("eleven_v4");
    vi.unstubAllEnvs();
  });

  it("جيل الوسوم: الثالث فما بعده، لا الثاني ولا flash", () => {
    expect(isTagGeneration("eleven_v4")).toBe(true);
    expect(isTagGeneration("eleven_v4_turbo")).toBe(true);
    expect(isTagGeneration("eleven_v3")).toBe(true);
    expect(isTagGeneration("eleven_multilingual_v2")).toBe(false);
    expect(isTagGeneration("eleven_flash_v2_5")).toBe(false);
  });

  it("موسيقى Eleven على music_v2_5 الأحدث افتراضياً", () => {
    expect(elevenMusicModel()).toBe("music_v2_5");
  });
});
