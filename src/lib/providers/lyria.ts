import { pcm16ToWav } from "@/lib/mockAudio";
import type { AudioResult, MusicProvider, MusicRequest } from "./types";

/** نموذج توليد الموسيقى — Lyria 3 Pro يدعم أغانٍ حتى ~3 دقائق بجودة عالية */
const MODEL = process.env.LYRIA_MODEL ?? "lyria-3-pro-preview";

export class LyriaError extends Error {
  constructor(message: string, readonly status: number, readonly needsBilling = false) {
    super(message);
  }
}

type Part = { inlineData?: { mimeType?: string; data?: string }; text?: string };

/** استخراج أول جزء صوتي من استجابة Gemini وتحويله لصيغة قابلة للتشغيل */
function extractAudio(parts: Part[]): { audio: Buffer; mimeType: string } | null {
  for (const part of parts) {
    const mime = part.inlineData?.mimeType ?? "";
    const data = part.inlineData?.data;
    if (!data || !mime.startsWith("audio/")) continue;

    const raw = Buffer.from(data, "base64");

    // PCM خام (audio/L16;codec=pcm;rate=48000) يحتاج ترويسة WAV ليعمل في المتصفح
    if (/^audio\/(l16|pcm)/i.test(mime)) {
      const rate = Number(mime.match(/rate=(\d+)/i)?.[1] ?? 48000);
      const channels = Number(mime.match(/channels=(\d+)/i)?.[1] ?? 2);
      return { audio: pcm16ToWav(raw, rate, channels), mimeType: "audio/wav" };
    }
    return { audio: raw, mimeType: mime.split(";")[0] };
  }
  return null;
}

export function lyriaMusic(apiKey: string): MusicProvider {
  return {
    id: "lyria",
    async generate(req: MusicRequest): Promise<AudioResult> {
      const instrumentalOnly = req.styleId === "instrumental" || !req.lyrics?.trim();
      const seconds = Math.min(180, Math.max(15, req.durationSec ?? 60));

      const prompt = [
        req.stylePrompt,
        `Target duration: about ${seconds} seconds.`,
        instrumentalOnly
          ? "Instrumental only, no vocals."
          : `Sung vocals performing these Arabic lyrics:\n${req.lyrics!.trim()}`,
      ].join("\n");

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["AUDIO"] },
          }),
        }
      );

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        // الطبقة المجانية تعطي حصة صفرية لـ Lyria — نميّزها لعرض رسالة مفهومة للمستخدم
        const needsBilling = res.status === 429 && /limit:\s*0/.test(detail);
        throw new LyriaError(
          needsBilling
            ? "توليد الموسيقى بـ Lyria يتطلب تفعيل الفوترة في Google Cloud (غير متاح على الطبقة المجانية)"
            : `Lyria ${res.status}: ${detail.slice(0, 300)}`,
          res.status,
          needsBilling
        );
      }

      const json = await res.json();
      const candidate = json?.candidates?.[0];
      if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
        throw new LyriaError("رفض المحرك توليد هذا المقطع — جرّب وصفاً مختلفاً", 400);
      }

      const found = extractAudio(candidate?.content?.parts ?? []);
      if (!found) {
        throw new LyriaError("لم تتضمن استجابة Lyria أي مقطع صوتي", 502);
      }

      return { audio: found.audio, mimeType: found.mimeType, provider: "lyria" };
    },
  };
}
