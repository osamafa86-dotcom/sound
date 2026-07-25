import { MAQAMAT } from "@/lib/maqamat";
import { synthesizeChime, synthesizeMaqamScale } from "@/lib/mockAudio";
import type { AudioResult, MusicProvider, MusicRequest, TTSProvider, TTSRequest } from "./types";

export const mockTTS: TTSProvider = {
  id: "mock",
  async synthesize(_req: TTSRequest): Promise<AudioResult> {
    return {
      audio: synthesizeChime(),
      mimeType: "audio/wav",
      provider: "mock",
      mock: true,
    };
  },
};

export const mockMusic: MusicProvider = {
  id: "mock",
  async generate(req: MusicRequest): Promise<AudioResult> {
    const maqam = MAQAMAT.find((m) => m.id === req.maqamId) ?? MAQAMAT[0];
    return {
      audio: synthesizeMaqamScale(maqam.scale),
      mimeType: "audio/wav",
      provider: "mock",
      mock: true,
    };
  },
};

/**
 * اختيار المزوّد الفعلي حسب المفاتيح المتوفرة في البيئة.
 * عند إضافة ELEVENLABS_API_KEY / GEMINI_API_KEY لاحقاً تُستبدل هذه الدوال
 * بوحدات elevenlabs.ts / lyria.ts دون تغيير أي شيء في الواجهة أو المسارات.
 */
export function getTTSProvider(): TTSProvider {
  return mockTTS;
}

export function getMusicProvider(): MusicProvider {
  return mockMusic;
}
