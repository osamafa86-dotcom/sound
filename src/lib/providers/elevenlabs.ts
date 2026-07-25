import { VOICES } from "@/lib/voices";
import { pcm16ToWav } from "@/lib/mockAudio";
import type { AudioResult, MusicProvider, MusicRequest, TTSProvider, TTSRequest } from "./types";

const API_BASE = "https://api.elevenlabs.io/v1";

/** نموذج التوليد — multilingual_v2 مستقر وممتاز مع العربية؛ قابل للترقية لـ v3 عبر متغير البيئة */
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

class ElevenLabsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function apiCall(path: string, apiKey: string, body: unknown, query = ""): Promise<Buffer> {
  const res = await fetch(`${API_BASE}${path}${query}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ElevenLabsError(`ElevenLabs ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  return Buffer.from(await res.arrayBuffer());
}

export function elevenLabsTTS(apiKey: string): TTSProvider {
  return {
    id: "elevenlabs",
    async synthesize(req: TTSRequest): Promise<AudioResult> {
      // الأصوات المستنسخة تصل بصيغة custom:<voice_id> مباشرة من حساب ElevenLabs
      const customId = req.voiceId.startsWith("custom:") ? req.voiceId.slice(7) : undefined;
      if (customId && !/^[A-Za-z0-9]{8,64}$/.test(customId)) {
        throw new ElevenLabsError("معرّف الصوت المستنسخ غير صالح", 400);
      }
      const voice = VOICES.find((v) => v.id === req.voiceId);
      const elevenVoiceId = customId ?? voice?.elevenVoiceId;
      if (!elevenVoiceId) {
        throw new ElevenLabsError(`لا يوجد صوت ElevenLabs مطابق للمعرّف ${req.voiceId}`, 400);
      }

      const wantWav = req.format === "wav";
      const outputFormat = wantWav ? "pcm_44100" : "mp3_44100_128";

      const audio = await apiCall(
        `/text-to-speech/${elevenVoiceId}`,
        apiKey,
        {
          text: req.text,
          model_id: MODEL_ID,
          voice_settings: {
            stability: req.stability ?? 0.5,
            similarity_boost: 0.75,
            // النطاق المدعوم للسرعة في ElevenLabs هو 0.7–1.2
            speed: Math.min(1.2, Math.max(0.7, req.speed ?? 1)),
          },
        },
        `?output_format=${outputFormat}`
      );

      return {
        audio: wantWav ? pcm16ToWav(audio) : audio,
        mimeType: wantWav ? "audio/wav" : "audio/mpeg",
        provider: "elevenlabs",
      };
    },
  };
}

export function elevenLabsMusic(apiKey: string): MusicProvider {
  return {
    id: "eleven-music",
    async generate(req: MusicRequest): Promise<AudioResult> {
      const instrumentalOnly = req.styleId === "instrumental" || !req.lyrics?.trim();
      const prompt = [
        req.stylePrompt,
        instrumentalOnly
          ? "instrumental only, no vocals"
          : `Arabic vocals singing these lyrics:\n${req.lyrics!.trim()}`,
      ].join("\n");

      const audio = await apiCall("/music", apiKey, {
        prompt,
        music_length_ms: Math.min(300_000, Math.max(10_000, (req.durationSec ?? 60) * 1000)),
      });

      return {
        audio,
        mimeType: "audio/mpeg",
        provider: "eleven-music",
      };
    },
  };
}
