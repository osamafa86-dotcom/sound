import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { availableVoices, getTTSProvider } from "@/lib/providers";
import { VOICES } from "@/lib/voices";

const ENV_KEYS = [
  "ELEVENLABS_API_KEY",
  "AZURE_SPEECH_KEY",
  "AZURE_SPEECH_REGION",
  "MINIMAX_API_KEY",
  "MINIMAX_GROUP_ID",
] as const;
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("المحرك الاقتصادي 💠 (نطق MiniMax)", () => {
  const mmVoice = VOICES.find((v) => v.provider === "minimax")!;

  it("كتالوج الأصوات يضم أصواتاً اقتصادية بالجنسين وبمعرّفات محرك مكتملة", () => {
    const mm = VOICES.filter((v) => v.provider === "minimax");
    expect(mm.length).toBeGreaterThanOrEqual(2);
    // المقارنة تطابق جنس الصوت المختار — يلزم توفر الجنسين
    expect(mm.some((v) => v.gender === "male")).toBe(true);
    expect(mm.some((v) => v.gender === "female")).toBe(true);
    for (const v of mm) expect(v.minimaxVoiceId).toBeTruthy();
  });

  it("صوت اقتصادي بالمفاتيح المضبوطة يوجَّه لمحرك MiniMax", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    process.env.MINIMAX_API_KEY = "k2";
    process.env.MINIMAX_GROUP_ID = "g1";
    expect(getTTSProvider(mmVoice.id).id).toBe("minimax");
    // بقية الأصوات لا تتأثر
    expect(getTTSProvider("v-pal-m1").id).toBe("elevenlabs");
  });

  it("بلا مفاتيح MiniMax: الصوت الاقتصادي يعود لـ ElevenLabs بدل الفشل", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    expect(getTTSProvider(mmVoice.id).id).toBe("elevenlabs");
  });

  it("الأصوات الاقتصادية تظهر في المتاح فقط عند ضبط المفتاحين معاً", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    expect(availableVoices().some((v) => v.provider === "minimax")).toBe(false);

    process.env.MINIMAX_API_KEY = "k2";
    expect(availableVoices().some((v) => v.provider === "minimax")).toBe(false);

    process.env.MINIMAX_GROUP_ID = "g1";
    expect(availableVoices().some((v) => v.provider === "minimax")).toBe(true);
  });
});
