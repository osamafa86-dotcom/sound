import { afterEach, describe, expect, it, vi } from "vitest";
import type { DramaScript } from "@/lib/drama/types";

/**
 * إنتاج الدراما والبودكاست على الجيل الرابع بنطق مضمون: الكلمات الحساسة
 * وكلمات ذاكرة النطق بكتابتها الصوتية، ووسم الأداء في الرأس، وأرضية ثبات،
 * والوقفة صمت حقيقي لا وسم <break> — ومفتاح الرجوع للجيل الثاني يعيد القاموس.
 */

vi.mock("@/lib/pronunciation", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/pronunciation")>();
  return {
    ...real,
    listRules: vi.fn(async () => [{ word: "الحاج", alias: "الحَاجُّ" }]),
    findDictionary: vi.fn(async () => ({ id: "dict1", versionId: "ver1" })),
  };
});

/** مقطع نطق: ثلاثة إطارات MPEG-1 بمعدل 192kbps */
function speech(): Buffer {
  const one = Buffer.alloc(626, 0x55);
  Buffer.from([0xff, 0xfb, 0xb0, 0xc0]).copy(one, 0);
  return Buffer.concat([one, one, one]);
}

const SCRIPT: DramaScript = {
  title: "ليلة المطر",
  summary: "",
  mood: "حزين",
  maqamId: "saba",
  musicPromptEn: "",
  characters: [
    { id: "narrator", name: "الراوي", description: "", voiceId: "v-pal-m1", voiceReason: "" },
  ],
  lines: [
    {
      characterId: "narrator",
      text: "عاد الحاج إلى جَبَلِ أُحُد",
      emotion: "حزين",
      deliveryTag: "[sad]",
      criticalWords: ["أُحُد", "كلمة ليست في السطر"],
      stability: 0.8,
      speed: 1,
      pauseAfterMs: 800,
    },
    {
      characterId: "narrator",
      text: "وأغلق الباب",
      emotion: "هادئ",
      deliveryTag: "[made up tag]",
      stability: 0.6,
      speed: 1,
      pauseAfterMs: 0,
    },
  ],
};

async function render(env: Record<string, string> = {}) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(new Uint8Array(speech()), { status: 200 });
    })
  );
  const { renderDrama } = await import("@/lib/drama/render");
  const result = await renderDrama("key", SCRIPT);
  return { bodies, result };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("محرك الإنتاج الدرامي", () => {
  it("الجيل الرابع افتراضياً: الحساسة وذاكرة النطق صوتياً، والوسم في الرأس، ولا قاموس", async () => {
    const { bodies } = await render();
    expect(bodies).toHaveLength(2);
    expect(bodies[0].model_id).toBe("eleven_v4");
    expect(bodies[0].text).toBe("[sad] عاد /alħaːddʒu/ إلى جَبَلِ /ʔuħud/");
    // الثبات الرصين يتجاهل الوسوم فيُسقف عند «طبيعي»
    expect((bodies[0].voice_settings as { stability: number }).stability).toBe(0.5);
    // وسم خارج القائمة المسموحة لا يصل المحرك
    expect(bodies[1].text).toBe("وأغلق الباب");
    for (const b of bodies) {
      expect(String(b.text)).not.toContain("<break");
      expect(b.pronunciation_dictionary_locators).toBeUndefined();
    }
  });

  it("الوقفة صمت مُلصق بعد السطر بطولها الحقيقي", async () => {
    const { result } = await render();
    // سطران × 3 إطارات + 31 إطار صمت (800ms) بعد الأول ولا شيء بعد الثاني
    expect(result.audio.length).toBe((6 + 31) * 626);
    expect(result.durationSec).toBeCloseTo((37 * 626) / 24_000, 3);
  });

  it("مفتاح الرجوع للجيل الثاني: القاموس يعود، ولا وسوم ولا كتابة صوتية", async () => {
    const { bodies } = await render({ ELEVENLABS_DRAMA_MODEL: "eleven_multilingual_v2" });
    expect(bodies[0].model_id).toBe("eleven_multilingual_v2");
    expect(bodies[0].text).toBe("عاد الحاج إلى جَبَلِ أُحُد");
    expect((bodies[0].voice_settings as { stability: number }).stability).toBe(0.8);
    expect(bodies[0].pronunciation_dictionary_locators).toEqual([
      { pronunciation_dictionary_id: "dict1", version_id: "ver1" },
    ]);
  });
});

describe("أداء السطر", () => {
  it("بلا وسم يبقى النص والثبات كما هما", async () => {
    const { performLine } = await import("@/lib/drama/render");
    expect(performLine({ text: "سلام", stability: 0.8 }, true, [])).toEqual({ text: "سلام", stability: 0.8 });
  });

  it("جيل الوسوم: أرضية ثبات 0.5 تحمي التشكيل في الأسطر الانفعالية", async () => {
    const { performLine } = await import("@/lib/drama/render");
    const line = { text: "هٰذِهِ مَعْرَكَةُ أُحُد", stability: 0.3 };
    expect(performLine({ ...line, deliveryTag: "[dramatically]" }, true, []).stability).toBe(0.5);
    expect(performLine(line, true, []).stability).toBe(0.5);
    // الكلاسيكي يلتزم بالتشكيل في كل ثبات فيبقى الأداء الانفعالي كما كُتب
    expect(performLine(line, false, []).stability).toBe(0.3);
  });

  it("الوقفة على مقطع غير مفهوم لا تفسده", async () => {
    const { withPause } = await import("@/lib/drama/render");
    const raw = Buffer.from("not mp3");
    expect(withPause(raw, 500)).toBe(raw);
  });
});
