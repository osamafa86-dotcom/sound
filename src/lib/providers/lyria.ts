import type { AudioResult, MusicProvider, MusicRequest } from "./types";

/**
 * Google Lyria 3 عبر Gemini API — نقطة النهاية interactions (معاينة عامة).
 * الغناء العربي غير مدعوم رسمياً بعد، لذا نستخدم Lyria حصراً للموسيقى الآلية
 * بالمقامات وللمعاينات الرخيصة، حسب استراتيجية الخطة (القسم 2-ب).
 */
const API_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

/** Clip: مقاطع 30 ثانية للمعاينة؛ Pro: أغانٍ كاملة حتى بضع دقائق */
const CLIP_MODEL = process.env.LYRIA_CLIP_MODEL ?? "lyria-3-clip-preview";
const PRO_MODEL = process.env.LYRIA_PRO_MODEL ?? "lyria-3-pro-preview";

class LyriaError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type InteractionResponse = {
  steps?: {
    type?: string;
    content?: { type?: string; data?: string; mime_type?: string }[];
  }[];
};

export function lyriaMusic(apiKey: string, variant: "clip" | "pro"): MusicProvider {
  const id = variant === "clip" ? "lyria-clip" : "lyria-pro";
  return {
    id,
    async generate(req: MusicRequest): Promise<AudioResult> {
      const prompt = [
        req.stylePrompt,
        "Instrumental only, no vocals.",
        variant === "pro" && req.durationSec
          ? `Intended length: about ${Math.round(req.durationSec)} seconds.`
          : "",
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          model: variant === "clip" ? CLIP_MODEL : PRO_MODEL,
          input: prompt,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new LyriaError(`Lyria ${res.status}: ${detail.slice(0, 300)}`, res.status);
      }

      const data = (await res.json()) as InteractionResponse;
      const audioBlock = data.steps
        ?.flatMap((s) => s.content ?? [])
        .find((c) => c.type === "audio" && c.data);
      if (!audioBlock?.data) {
        throw new LyriaError("لم يُعثر على صوت في استجابة Lyria", 502);
      }

      return {
        audio: Buffer.from(audioBlock.data, "base64"),
        // الافتراضي MP3؛ يُحترم mime_type إن أعادته الواجهة
        mimeType: audioBlock.mime_type ?? "audio/mpeg",
        provider: id,
      };
    },
  };
}
