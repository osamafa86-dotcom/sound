import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { comparisonAvailable, getMusicProvider } from "@/lib/providers";

const ENV_KEYS = ["ELEVENLABS_API_KEY", "GEMINI_API_KEY", "MUSIC_PROVIDER"] as const;
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

describe("اختيار محرك الموسيقى ووضع المقارنة", () => {
  it("بلا مفاتيح: الوضع التجريبي، والمقارنة غير متاحة", () => {
    expect(getMusicProvider().id).toBe("mock");
    expect(comparisonAvailable()).toBe(false);
  });

  it("بالمفتاحين: Lyria حصراً (قرار المالك — بلا سلسلة رجوع)، والمقارنة متاحة", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    process.env.GEMINI_API_KEY = "k2";
    expect(getMusicProvider().id).toBe("lyria");
    expect(comparisonAvailable()).toBe(true);
  });

  it("MUSIC_PROVIDER=elevenlabs مهرب الرجوع لمحرك Eleven", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    process.env.GEMINI_API_KEY = "k2";
    process.env.MUSIC_PROVIDER = "elevenlabs";
    expect(getMusicProvider().id).toBe("eleven-music");
  });

  it("فرض محرك المقارنة يعيده بعينه — بلا سلسلة رجوع بين المحركين", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    process.env.GEMINI_API_KEY = "k2";
    expect(getMusicProvider({ force: "lyria" }).id).toBe("lyria");
    expect(getMusicProvider({ force: "eleven-music" }).id).toBe("eleven-music");
  });

  it("فرض المهمة (المقارنة) يتقدم على فرض البيئة MUSIC_PROVIDER", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    process.env.GEMINI_API_KEY = "k2";
    process.env.MUSIC_PROVIDER = "elevenlabs";
    expect(getMusicProvider({ force: "lyria" }).id).toBe("lyria");
  });

  it("فرض محرك مفقود المفتاح يعود للمتاح بدل الفشل", () => {
    process.env.ELEVENLABS_API_KEY = "k1";
    expect(getMusicProvider({ force: "lyria" }).id).toBe("eleven-music");
    expect(comparisonAvailable()).toBe(false);
  });
});
