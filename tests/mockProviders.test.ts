import { describe, expect, it } from "vitest";
import { mockMusic, mockTTS } from "@/lib/providers/mock";
import { mockAssistant } from "@/lib/assistant/mock";

describe("المزوّدات التجريبية", () => {
  it("موسيقى تجريبية: ملف WAV صالح بترويسة RIFF", async () => {
    const result = await mockMusic.generate({
      maqamId: "saba",
      styleId: "tarab",
      instrumentIds: [],
      stylePrompt: "",
    });
    expect(result.mimeType).toBe("audio/wav");
    expect(result.mock).toBe(true);
    expect(result.audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(result.audio.subarray(8, 12).toString("ascii")).toBe("WAVE");
  });

  it("TTS تجريبي: نغمة WAV صالحة", async () => {
    const result = await mockTTS.synthesize({ text: "مرحبا", voiceId: "x" });
    expect(result.mimeType).toBe("audio/wav");
    expect(result.audio.subarray(0, 4).toString("ascii")).toBe("RIFF");
  });

  it("مساعد الكلمات التجريبي: يقترح صبا لنص الحزن ويعيد بنية كاملة", async () => {
    const result = await mockAssistant.assist({
      mode: "improve",
      lyrics: "يا دمعة الفراق وحزن الليالي",
      dialectId: "fusha",
      styleId: "tarab",
    });
    expect(result.maqamId).toBe("saba");
    expect(result.mock).toBe(true);
    expect(result.lyrics).toContain("الفراق");
    expect(result.stylePromptEn.length).toBeGreaterThan(20);
  });

  it("مساعد الكلمات التجريبي: وضع الكتابة يولّد مسودة تحمل الفكرة", async () => {
    const result = await mockAssistant.assist({
      mode: "write",
      idea: "فرحة النجاح",
      dialectId: "egyptian",
      styleId: "pop",
    });
    expect(result.lyrics).toContain("فرحة النجاح");
    expect(result.maqamId).toBe("ajam");
  });
});
