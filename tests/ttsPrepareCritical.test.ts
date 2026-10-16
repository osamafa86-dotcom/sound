import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * النطق المضمون في استوديو النطق: اختيار المستخدم الصريح من المحرر يتقدم
 * على الاكتشاف الآلي (فلا نداء Gemini)، والتلقائي يكتشف عند غيابه، وأصوات
 * غير ElevenLabs لا يُفرض عليها شيء. ولا يُبلَّغ إلا ما تحسمه حركاته.
 */

const findCriticalWords = vi.fn(async () => ["أُحُد"]);

vi.mock("@/lib/tts/criticalWords", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tts/criticalWords")>()),
  findCriticalWords,
}));
vi.mock("@/lib/pronunciation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/pronunciation")>()),
  listRules: vi.fn(async () => []),
}));
vi.mock("@/lib/brain", () => ({ getVoiceTuning: vi.fn(async () => new Map()) }));
vi.mock("@/lib/customVoices", () => ({ getCustomVoice: vi.fn(async () => null) }));

const TEXT = "هٰذِهِ مَعْرَكَةُ أُحُد وَعِلْمٌ";

beforeEach(() => {
  findCriticalWords.mockClear();
  vi.stubEnv("ELEVENLABS_API_KEY", "el-key");
  vi.stubEnv("GEMINI_API_KEY", "gm-key");
});
afterEach(() => vi.unstubAllEnvs());

async function prepare(body: Record<string, unknown>, opts?: { detectCritical?: boolean }) {
  const { prepareTTSRequest } = await import("@/lib/tts/prepare");
  const out = await prepareTTSRequest({ voiceId: "v-fusha-f1", expressive: false, ...body }, null, opts);
  if ("error" in out) throw new Error(out.error);
  return out.request;
}

describe("الكلمات الحساسة في تحضير النطق", () => {
  it("التلقائي: يكتشفها الخادم حين لا يرسل المحرر قائمة", async () => {
    const req = await prepare({ text: TEXT });
    expect(findCriticalWords).toHaveBeenCalledTimes(1);
    expect(req.criticalWords).toEqual(["أُحُد"]);
  });

  it("الاختيار الصريح يتقدم: لا نداء Gemini، ويُصفّى بالنص وبما تحسمه الحركات", async () => {
    const req = await prepare({ text: TEXT, criticalWords: ["وَعِلْمٌ", "بَدْر", "أحد"] });
    expect(findCriticalWords).not.toHaveBeenCalled();
    expect(req.criticalWords).toEqual(["وَعِلْمٌ"]);
  });

  it("قائمة فارغة صريحة = لا فرض ولا اكتشاف", async () => {
    const req = await prepare({ text: TEXT, criticalWords: [] });
    expect(findCriticalWords).not.toHaveBeenCalled();
    expect(req.criticalWords).toBeUndefined();
  });

  it("البث المتدفق يحترم القائمة الصريحة ويتخطى الاكتشاف الآلي", async () => {
    const explicit = await prepare({ text: TEXT, criticalWords: ["أُحُد"] }, { detectCritical: false });
    expect(explicit.criticalWords).toEqual(["أُحُد"]);
    const auto = await prepare({ text: TEXT }, { detectCritical: false });
    expect(auto.criticalWords).toBeUndefined();
    expect(findCriticalWords).not.toHaveBeenCalled();
  });

  it("أصوات غير ElevenLabs لا يُفرض عليها شيء", async () => {
    const { VOICES } = await import("@/lib/voices");
    const other = VOICES.find((v) => v.provider !== "elevenlabs");
    if (!other) return;
    const req = await prepare({ text: TEXT, voiceId: other.id, criticalWords: ["أُحُد"] });
    expect(req.criticalWords).toBeUndefined();
  });
});
