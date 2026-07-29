import { VOICES } from "@/lib/voices";
import { pcm16ToWav } from "@/lib/mockAudio";
import { findDictionary } from "@/lib/pronunciation";
import { splitTextForTTS } from "@/lib/tts/split";
import { buildCompositionPlan, buildElevenMusicPrompt } from "./compositionPlan";
import type { AudioResult, MusicProvider, MusicRequest, TTSProvider, TTSRequest } from "./types";

const API_BASE = "https://api.elevenlabs.io/v1";

/** نموذج التوليد المتوازن — multilingual_v2 مستقر وممتاز مع العربية */
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
/** المحرك التعبيري — الجيل الثالث بوسوم المشاعر والأفعال داخل النص */
const V3_MODEL_ID = process.env.ELEVENLABS_V3_MODEL ?? "eleven_v3";

/** الجيل الثالث يقبل ثلاث درجات ثبات فقط: 0 مبدع | 0.5 طبيعي | 1 رصين */
export function snapStabilityV3(value: number): 0 | 0.5 | 1 {
  if (value < 0.25) return 0;
  if (value < 0.75) return 0.5;
  return 1;
}

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
      const expressive = !!req.expressive;

      // ذاكرة النطق: قاموس المحرك للجيل الثاني — والجيل الثالث لا يدعمه
      // (تتكفل به قواعد الاستبدال النصية المطبقة في المسار قبل الوصول هنا)
      const dict = expressive ? null : await findDictionary(apiKey).catch(() => null);

      // إعدادات الصوت حسب الجيل: الثالث يقبل ثلاث درجات ثبات بلا سرعة/حيوية،
      // والثاني يدعم السرعة وقوة التعبير (style) وتعزيز الحضور
      const voiceSettings = expressive
        ? {
            stability: snapStabilityV3(req.stability ?? 0.5),
            similarity_boost: 0.75,
            use_speaker_boost: true,
          }
        : {
            stability: req.stability ?? 0.5,
            similarity_boost: 0.75,
            // النطاق المدعوم للسرعة في ElevenLabs هو 0.7–1.2
            speed: Math.min(1.2, Math.max(0.7, req.speed ?? 1)),
            ...(req.liveliness !== undefined && {
              style: Math.min(1, Math.max(0, req.liveliness)),
            }),
            use_speaker_boost: req.speakerBoost ?? true,
          };

      // النصوص الطويلة تُقسَّم عند حدود الجمل وتُدمج مخرجاتها (mp3 مباشرة، وwav عبر PCM خام)
      // بادئة الأسلوب تُحقن في كل جزء كي يبقى الأداء موحداً عبر الأجزاء
      const chunks = splitTextForTTS(req.text);
      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        buffers.push(
          await apiCall(
            `/text-to-speech/${elevenVoiceId}`,
            apiKey,
            {
              text: req.stylePrefix ? `${req.stylePrefix} ${chunk}` : chunk,
              model_id: expressive ? V3_MODEL_ID : MODEL_ID,
              voice_settings: voiceSettings,
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

/** عازل الصوت — يفصل الكلام عن الضجيج والموسيقى الخلفية ويعيد تسجيلاً نقياً */
export async function elevenLabsIsolateAudio(apiKey: string, audio: Blob): Promise<AudioResult> {
  const form = new FormData();
  form.append("audio", audio, "noisy.webm");
  const res = await apiCallMultipart("/audio-isolation", apiKey, form);
  return {
    audio: Buffer.from(await res.arrayBuffer()),
    mimeType: res.headers.get("Content-Type")?.split(";")[0] || "audio/mpeg",
    provider: "elevenlabs-isolation",
  };
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

/**
 * نموذج Eleven Music: الأحدث (music_v2 — حزيران 2026) افتراضياً بجودة أعلى
 * وإخراج 48kHz/192kbps، وELEVEN_MUSIC_MODEL=music_v1 مفتاح رجوع للسلوك القديم.
 */
function elevenMusicModel(): string {
  return process.env.ELEVEN_MUSIC_MODEL ?? "music_v2";
}

export function elevenLabsMusic(apiKey: string): MusicProvider {
  return {
    id: "eleven-music",
    async generate(req: MusicRequest): Promise<AudioResult> {
      const model = elevenMusicModel();
      const isRegen = !!req.sourceSongId && req.regenerateIndex !== undefined;

      // الترقيع الجزئي (source_from) لغة خطة v1 المثبتة حياً — يبقى عليها،
      // وكذلك كامل مسار الخطة عند فرض v1 عبر البيئة
      const plan = isRegen || model === "music_v1" ? buildCompositionPlan(req) : null;
      if (plan) {
        const { audio, songId } = await musicCall(apiKey, {
          model_id: "music_v1",
          composition_plan: plan,
        });
        return { audio, mimeType: "audio/mpeg", provider: "eleven-music", providerSongId: songId };
      }

      // النموذج الأحدث: البنية والكلمات داخل البرومبت — v2 يفهمها نصاً
      // (ويتجاهل فرض مدد الخطة أصلاً، فلا نفقد تحكماً فعلياً)
      const { audio, songId } = await musicCall(apiKey, {
        model_id: model,
        prompt: buildElevenMusicPrompt(req),
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
