import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * كاتب السيناريو الدرامي والبودكاست: الأحدث أولاً عبر السلسلة، ووسم الأداء
 * مطلوب في المخطط ومطهَّر في الناتج (none والمخترع لا يصلان المحرك).
 */

const SCRIPT = {
  title: "ليلة المطر",
  summary: "",
  mood: "حزين",
  maqamId: "saba",
  musicPromptEn: "soft oud",
  characters: [{ id: "narrator", name: "الراوي", description: "", voiceId: "v-pal-m1", voiceReason: "" }],
  lines: [
    { characterId: "narrator", text: "سطر أول", emotion: "حزين", deliveryTag: "[sad]", stability: 0.4, speed: 1, pauseAfterMs: 400 },
    { characterId: "narrator", text: "سطر ثانٍ", emotion: "هادئ", deliveryTag: "none", stability: 0.7, speed: 1, pauseAfterMs: 300 },
    { characterId: "narrator", text: "سطر ثالث", emotion: "غاضب", deliveryTag: "[furious yelling]", stability: 0.3, speed: 1, pauseAfterMs: 300 },
  ],
};

function stubGemini() {
  const calls: { url: string; body: { generationConfig: { responseSchema: unknown } } }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(SCRIPT) }] } }] }),
        { status: 200 }
      );
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("كاتب السيناريو", () => {
  it("الدراما: يطلب gemini-3.8-flash أولاً ويطهّر وسوم الأداء", async () => {
    const calls = stubGemini();
    const { analyzeDrama } = await import("@/lib/drama/analyze");
    const script = await analyzeDrama("key", "نص", "فصحى");

    expect(calls[0].url).toContain("/models/gemini-3.8-flash:generateContent");
    const lineSchema = (calls[0].body.generationConfig.responseSchema as {
      properties: { lines: { items: { required: string[]; properties: { deliveryTag: { enum: string[] } } } } };
    }).properties.lines.items;
    expect(lineSchema.required).toContain("deliveryTag");
    expect(lineSchema.properties.deliveryTag.enum).toContain("none");
    expect(lineSchema.properties.deliveryTag.enum).toContain("[whispers]");

    expect(script.lines.map((l) => l.deliveryTag)).toEqual(["[sad]", undefined, undefined]);
  });

  it("البودكاست: السلسلة نفسها والتطهير نفسه", async () => {
    const calls = stubGemini();
    const { generatePodcast } = await import("@/lib/podcast/script");
    const script = await generatePodcast("key", "موضوع", "short", "casual", "فصحى");

    expect(calls[0].url).toContain("/models/gemini-3.8-flash:generateContent");
    expect(script.lines.map((l) => l.deliveryTag)).toEqual(["[sad]", undefined, undefined]);
  });
});
