import { describe, expect, it } from "vitest";
import { splitTextForTTS } from "@/lib/tts/split";

describe("تقسيم النصوص الطويلة للـ TTS", () => {
  it("النص القصير يعود كما هو في مقطع واحد", () => {
    expect(splitTextForTTS("مرحباً بكم في مقام.")).toEqual(["مرحباً بكم في مقام."]);
  });

  it("النص الفارغ يعيد مصفوفة فارغة", () => {
    expect(splitTextForTTS("   ")).toEqual([]);
  });

  it("يقسم عند حدود الجمل ولا يقطع وسط جملة", () => {
    const sentence = "هذه جملة عربية كاملة تنتهي بنقطة. ";
    const text = sentence.repeat(50);
    const chunks = splitTextForTTS(text, 300);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(300);
      // كل مقطع ينتهي عند حد جملة
      expect(chunk.endsWith(".")).toBe(true);
    }
  });

  it("يحافظ على النص كاملاً بلا فقد", () => {
    const sentence = "جملة أولى؟ جملة ثانية! جملة ثالثة. ";
    const text = sentence.repeat(40);
    const chunks = splitTextForTTS(text, 250);
    const rejoined = chunks.join(" ").replace(/\s+/g, " ");
    const original = text.trim().replace(/\s+/g, " ");
    expect(rejoined).toBe(original);
  });

  it("نص بلا فواصل يُقطع بالقوة عند الحد", () => {
    const text = "ا".repeat(1000);
    const chunks = splitTextForTTS(text, 300);
    expect(chunks.length).toBe(4);
    expect(chunks.every((c) => c.length <= 300)).toBe(true);
  });
});
