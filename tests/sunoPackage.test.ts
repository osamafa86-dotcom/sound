import { describe, expect, it } from "vitest";
import {
  SUNO_LIMITS,
  sunoLyrics,
  sunoStyle,
  sunoTitle,
  trimAtComma,
} from "@/lib/sunoPackage";
import { canConnect, NODE_DEFS } from "@/lib/studio/graph";
import type { SongSection } from "@/lib/songSections";

const song: SongSection[] = [
  { kind: "intro", lyrics: "", durationSec: 10 },
  { kind: "verse", lyrics: "يا طَيرَ الحُرِّيَّةِ حَلِّق\nفَوقَ الزَّيتون", durationSec: 20 },
  { kind: "chorus", lyrics: "صَوتُنا مِن هُنا\nمِن قَلبِ فِلَسطين", durationSec: 20 },
  { kind: "verse", lyrics: "واحكِ لِلدُّنيا حِكايَتَنا", durationSec: 20 },
  { kind: "outro", lyrics: "", durationSec: 10 },
];

describe("حزمة Suno — كلمات بعلامات المقاطع", () => {
  it("تعلّم كل مقطع بعلامة Suno وترقّم المقاطع المتكررة", () => {
    const out = sunoLyrics(song);
    expect(out).toContain("[Verse 1]\nيا طَيرَ");
    expect(out).toContain("[Verse 2]\nواحكِ");
    expect(out).toContain("[Chorus]\nصَوتُنا");
  });

  it("المقاطع الآلية الفارغة تُترك للعزف بعلامة Instrumental", () => {
    const out = sunoLyrics(song);
    expect(out).toMatch(/^\[Intro\]\n\[Instrumental\]/);
    expect(out.trim().endsWith("[Outro]\n[Instrumental]")).toBe(true);
  });

  it("مقطع واحد لا يُرقَّم — والتشكيل يبقى كما هو", () => {
    const out = sunoLyrics([{ kind: "verse", lyrics: "حَبيبي", durationSec: 10 }]);
    expect(out).toBe("[Verse]\nحَبيبي");
  });

  it("لا تتجاوز حد حقل الكلمات في Suno", () => {
    const long = Array.from({ length: 40 }, () => ({
      kind: "verse" as const,
      lyrics: "كلمة ".repeat(60),
      durationSec: 20,
    }));
    expect(sunoLyrics(long).length).toBeLessThanOrEqual(SUNO_LIMITS.lyrics);
  });
});

describe("حزمة Suno — برومبت الأسلوب والعنوان", () => {
  it("يبدأ بالأسلوب والصوت العربي ويحمل روح المقام واللهجة", () => {
    const style = sunoStyle({
      maqamId: "bayati",
      styleId: "tarab",
      dialectId: "palestinian",
      singer: "male",
      instrumentIds: ["oud"],
    });
    expect(style.startsWith("classical Arabic tarab, male Arabic vocals")).toBe(true);
    expect(style).toContain("Palestinian");
    expect(style).toContain("oud");
    expect(style.length).toBeLessThanOrEqual(SUNO_LIMITS.style);
  });

  it("مقام غير معروف يعود للمقام الأول بدل الانهيار", () => {
    expect(sunoStyle({ maqamId: "nope", styleId: "" }).length).toBeGreaterThan(20);
  });

  it("القص عند حدود الفاصلة لا في منتصف وصف", () => {
    expect(trimAtComma("aaa, bbbb, cccccc", 12)).toBe("aaa, bbbb");
    expect(trimAtComma("short", 50)).toBe("short");
  });

  it("العنوان: صريح أولاً، وإلا أول سطر من اللازمة بلا حركات", () => {
    expect(sunoTitle(song, "يافا")).toBe("يافا");
    expect(sunoTitle(song)).toBe("صوتنا من هنا");
    expect(sunoTitle([])).toBe("أغنية من مقام");
  });
});

describe("بطاقة أداء Suno في المساحة", () => {
  it("تستقبل كلمات وتُخرج أغنية تكمل السلسلة", () => {
    expect(NODE_DEFS.suno.inputs[0].accepts).toEqual(["text"]);
    expect(canConnect({ kind: "lyrics" }, { kind: "suno" })).toBe(true);
    expect(canConnect({ kind: "suno" }, { kind: "split" })).toBe(true);
    expect(canConnect({ kind: "suno" }, { kind: "save" })).toBe(true);
    expect(canConnect({ kind: "upload" }, { kind: "suno" })).toBe(false);
  });

  it("بلا كلفة نقاط — التوليد يتم بحساب المستخدم في Suno", () => {
    expect(NODE_DEFS.suno.cost).toBeUndefined();
  });
});
