import { VOICES } from "@/lib/voices";
import { pcm16ToWav } from "@/lib/mockAudio";
import { findDictionary } from "@/lib/pronunciation";
import { splitTextForTTS } from "@/lib/tts/split";
import { buildCompositionPlan } from "./compositionPlan";
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

export function elevenLabsTTS(apiKey: string): TTSProvider {
  return {
    id: "elevenlabs",
    async synthesize(req: TTSRequest): Promise<AudioResult> {
      // الأصوات المستنسخة تصل بصيغة custom:<voice_id> مباشرة من حساب ElevenLabs،
      // أو كمعرّف ElevenLabs مباشر (elevenVoiceId) من سجل أصوات المستخدم
      const customId = req.voiceId.startsWith("custom:") ? req.voiceId.slice(7) : undefined;
      if (customId && !/^[A-Za-z0-9]{8,64}$/.test(customId)) {
        throw new ElevenLabsError("معرّف الصوت المستنسخ غير صالح", 400);
      }
      const voice = VOICES.find((v) => v.id === req.voiceId);
      const elevenVoiceId = req.elevenVoiceId ?? customId ?? voice?.elevenVoiceId;
      if (!elevenVoiceId) {
        throw new ElevenLabsError(`لا يوجد صوت ElevenLabs مطابق للمعرّف ${req.voiceId}`, 400);
      }

      const wantWav = req.format === "wav";
      // باقة Creator تتيح جودة 192kbps — قابلة للتخفيض عبر متغير البيئة عند تغيير الباقة
      const mp3Quality = process.env.ELEVENLABS_MP3_QUALITY ?? "mp3_44100_192";
      const outputFormat = wantWav ? "pcm_44100" : mp3Quality;

      // ذاكرة النطق المتراكمة للمنصة — تُطبَّق تلقائياً على كل توليد
      const dict = await findDictionary(apiKey).catch(() => null);

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
              ...(dict?.id && {
                pronunciation_dictionary_locators: [
                  { pronunciation_dictionary_id: dict.id, ...(dict.versionId && { version_id: dict.versionId }) },
                ],
              }),
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

/** تفريغ موقوت: كل كلمة مع بدايتها ونهايتها بالثواني — وقود الكاريوكي */
export async function elevenLabsTranscribeWords(
  apiKey: string,
  audio: Blob
): Promise<{ text: string; words: { text: string; start: number; end: number }[] }> {
  const form = new FormData();
  form.append("model_id", "scribe_v1");
  form.append("timestamps_granularity", "word");
  form.append("file", audio, "song.mp3");
  const res = await apiCallMultipart("/speech-to-text", apiKey, form);
  const data = (await res.json()) as {
    text?: string;
    words?: { text: string; start: number; end: number; type?: string }[];
  };
  if (typeof data.text !== "string") {
    throw new ElevenLabsError("استجابة تفريغ غير متوقعة", 502);
  }
  const words = (data.words ?? [])
    .filter((w) => (w.type ?? "word") === "word" && Number.isFinite(w.start))
    .map((w) => ({ text: w.text, start: w.start, end: w.end }));
  return { text: data.text, words };
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

/** نداء توليد موسيقى مع التقاط معرّف الأغنية من الترويسات — يفتح إعادة التوليد الجزئي */
async function musicCall(
  apiKey: string,
  body: unknown
): Promise<{ audio: Buffer; songId?: string }> {
  const res = await fetch(`${API_BASE}/music`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new ElevenLabsError(`ElevenLabs ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }

  let songId: string | undefined;
  res.headers.forEach((value, key) => {
    if (/song[-_]?id/i.test(key)) songId = value;
  });
  return { audio: Buffer.from(await res.arrayBuffer()), songId };
}

export function elevenLabsMusic(apiKey: string): MusicProvider {
  return {
    id: "eleven-music",
    async generate(req: MusicRequest): Promise<AudioResult> {
      // مقاطع مُهيكلة ← خطة تأليف كاملة: تحكم حقيقي في البنية والمدد لكل مقطع
      const plan = buildCompositionPlan(req);
      if (plan) {
        const { audio, songId } = await musicCall(apiKey, {
          model_id: "music_v1",
          composition_plan: plan,
        });
        return { audio, mimeType: "audio/mpeg", provider: "eleven-music", providerSongId: songId };
      }

      const instrumentalOnly = req.styleId === "instrumental" || !req.lyrics?.trim();
      const prompt = [
        req.stylePrompt,
        ...(req.bpm ? [`${req.bpm} BPM`] : []),
        ...(req.singer && !instrumentalOnly ? [`${req.singer} Arabic lead vocals`] : []),
        ...(req.dialectEn && !instrumentalOnly
          ? [`authentic ${req.dialectEn} Arabic dialect, native-speaker pronunciation`]
          : []),
        instrumentalOnly
          ? "instrumental only, no vocals"
          : `Arabic vocals singing these lyrics exactly as written:\n${req.lyrics!.trim()}`,
      ].join("\n");

      const { audio, songId } = await musicCall(apiKey, {
        prompt,
        music_length_ms: Math.min(300_000, Math.max(10_000, (req.durationSec ?? 60) * 1000)),
      });

      return {
        audio,
        mimeType: "audio/mpeg",
        provider: "eleven-music",
        providerSongId: songId,
      };
    },
  };
}
