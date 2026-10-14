import { describe, expect, it } from "vitest";
import { snapStabilityV3, voiceSettingsFor } from "@/lib/providers/elevenlabs";
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
