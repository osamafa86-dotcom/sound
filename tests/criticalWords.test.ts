import { afterEach, describe, expect, it, vi } from "vitest";
import { findCriticalWords, keepPresent } from "@/lib/tts/criticalWords";

/**
 * محلل الكلمات الحساسة: لا يُفرض صوتياً إلا ما ورد في النص فعلاً بتشكيله،
 * ونص بلا تشكيل لا يُحلَّل، وأي فشل يعيد قائمة فارغة فيمضي النطق كما كان.
 */

const TEXT = "وَقَعَتْ مَعْرَكَةُ أُحُدٍ عِنْدَ جَبَلِ أُحُد";

function geminiReturns(words: unknown) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ words }) }] } }] }),
        { status: 200 }
      );
    })
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("الكلمات الحساسة", () => {
  it("keepPresent يُبقي ما ورد في النص بتشكيله ويُسقط المخترع والعاري والمكرر", () => {
    expect(keepPresent(["أُحُد", "أُحُدٍ", "أحد", "بَدْر", "أُحُد", 7], TEXT)).toEqual(["أُحُد", "أُحُدٍ"]);
    expect(keepPresent("ليست قائمة", TEXT)).toEqual([]);
    expect(keepPresent(["أُحُد", "أُحُدٍ"], TEXT, 1)).toEqual(["أُحُد"]);
  });

  it("يستخرج من Gemini ويصفّي بالنص", async () => {
    const calls = geminiReturns(["أُحُدٍ", "مَعْرَكَةَ"]);
    expect(await findCriticalWords("key", TEXT)).toEqual(["أُحُدٍ"]);
    expect(calls[0]).toContain("/models/gemini-3.8-flash:generateContent");
  });

  it("نص بلا تشكيل لا يُحلَّل أصلاً", async () => {
    const calls = geminiReturns(["أحد"]);
    expect(await findCriticalWords("key", "وقعت معركة أحد")).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it("فشل المحلل لا يوقف النطق — قائمة فارغة", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    expect(await findCriticalWords("key", TEXT)).toEqual([]);
  });
});
