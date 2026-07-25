import { VOICES } from "@/lib/voices";
import { pcm16ToWav } from "@/lib/mockAudio";
import { splitTextForTTS } from "@/lib/tts/split";
import type { AudioResult, MusicProvider, MusicRequest, TTSProvider, TTSRequest } from "./types";

const API_BASE = "https://api.elevenlabs.io/v1";

/** نموذج التوليد — multilingual_v2 مستقر وممتاز مع العربية؛ قابل للترقية لـ v3 عبر متغير البيئة */
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

class ElevenLabsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function apiCallMultipart(path: string, apiKey: string, form: FormData): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ElevenLabsError(`ElevenLabs ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }
  return res;
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
      // الأصوات المستنسخة تمرر معرّف ElevenLabs مباشرة؛ أصوات الكتالوج تُحل من القائمة
      const voice = VOICES.find((v) => v.id === req.voiceId);
      const elevenVoiceId = req.elevenVoiceId ?? voice?.elevenVoiceId;
      if (!elevenVoiceId) {
        throw new ElevenLabsError(`لا يوجد صوت ElevenLabs مطابق للمعرّف ${req.voiceId}`, 400);
      }

      const wantWav = req.format === "wav";
      const outputFormat = wantWav ? "pcm_44100" : "mp3_44100_128";

      // النصوص الطويلة تُقسَّم عند حدود الجمل وتُدمج مخرجاتها (mp3 مباشرة، وwav عبر PCM خام)
      const chunks = splitTextForTTS(req.text);
      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        buffers.push(
          await apiCall(
            `/text-to-speech/${elevenVoiceId}`,
            apiKey,
            {
              text: chunk,
              model_id: MODEL_ID,
              voice_settings: {
                stability: req.stability ?? 0.5,
                similarity_boost: 0.75,
                // النطاق المدعوم للسرعة في ElevenLabs هو 0.7–1.2
                speed: Math.min(1.2, Math.max(0.7, req.speed ?? 1)),
              },
            },
            `?output_format=${outputFormat}`
          )
        );
      }

      const joined = Buffer.concat(buffers);
      return {
        audio: wantWav ? pcm16ToWav(joined) : joined,
        mimeType: wantWav ? "audio/wav" : "audio/mpeg",
        provider: "elevenlabs",
      };
    },
  };
}

/** تفريغ صوتي (Speech-to-Text) عبر نموذج Scribe */
export async function elevenLabsTranscribe(apiKey: string, audio: Blob): Promise<string> {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("file", audio, "recording.webm");
  const res = await apiCallMultipart("/speech-to-text", apiKey, form);
  const data = (await res.json()) as { text?: string };
  if (typeof data.text !== "string") {
    throw new ElevenLabsError("استجابة تفريغ غير متوقعة", 502);
  }
  return data.text;
}

/** تحويل صوت إلى صوت (Speech-to-Speech) — يحافظ على الأداء والتوقيت بصوت آخر */
export async function elevenLabsSpeechToSpeech(
  apiKey: string,
  targetElevenVoiceId: string,
  audio: Blob
): Promise<AudioResult> {
  const form = new FormData();
  form.append("model_id", "eleven_multilingual_sts_v2");
  form.append("audio", audio, "recording.webm");
  const res = await apiCallMultipart(
    `/speech-to-speech/${targetElevenVoiceId}?output_format=mp3_44100_128`,
    apiKey,
    form
  );
  return {
    audio: Buffer.from(await res.arrayBuffer()),
    mimeType: "audio/mpeg",
    provider: "elevenlabs-sts",
  };
}

/** استنساخ صوت فوري (Instant Voice Cloning) من عينة أو أكثر */
export async function elevenLabsCloneVoice(
  apiKey: string,
  name: string,
  samples: Blob[]
): Promise<string> {
  const form = new FormData();
  form.append("name", name);
  form.append("remove_background_noise", "true");
  samples.forEach((sample, i) => form.append("files", sample, `sample-${i + 1}.webm`));
  const res = await apiCallMultipart("/voices/add", apiKey, form);
  const data = (await res.json()) as { voice_id?: string };
  if (!data.voice_id) {
    throw new ElevenLabsError("لم يُعد ElevenLabs معرّف الصوت المستنسخ", 502);
  }
  return data.voice_id;
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
