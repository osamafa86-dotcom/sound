import { isInstrumentalRequest } from "./compositionPlan";
import { stripAudioTags } from "@/lib/performance/tags";
import { VOICES } from "@/lib/voices";
import type { AudioResult, MusicProvider, MusicRequest, TTSProvider, TTSRequest } from "./types";
import type { SectionKind } from "@/lib/songSections";

/**
 * MiniMax Music — المحرك الرابع للتلحين (تجريبي بقرار تحكيم سمعي لاحق):
 * يولّد الغناء والتوزيع معاً من كلمات موسومة بعلامات المقاطع + برومبت أسلوبي.
 *
 * ملاحظات محاسبة من الاختبار الحي (آب 2026): توليد الموسيقى يُخصم من رصيد
 * Pay-as-you-go (شحن Balance) لا من نقاط اشتراك الصوت — رصيد فارغ يعيد 1008.
 */

const MODEL = process.env.MINIMAX_MUSIC_MODEL ?? "music-3.0";

/** علامات المقاطع بصيغة MiniMax — تعادل ترويساتنا العربية (لازمة: ← [Chorus]) */
const SECTION_MARKS: Record<SectionKind, string> = {
  intro: "[Intro]",
  verse: "[Verse]",
  chorus: "[Chorus]",
  bridge: "[Bridge]",
  outro: "[Outro]",
};

export class MinimaxError extends Error {
  constructor(
    message: string,
    readonly code: number,
    /** رصيد الدفع-حسب-الاستخدام فارغ — رسالة شحن لا عطل تقني */
    readonly needsTopUp = false
  ) {
    super(message);
  }
}

/** كلمات الغناء بعلامات مقاطع لاتينية — الترويسات العربية تُغنى حرفياً لو مُررت */
function buildLyrics(req: MusicRequest): string {
  if (req.sections?.length) {
    return req.sections
      .map((s) => `${SECTION_MARKS[s.kind] ?? "[Verse]"}\n${s.lyrics.trim()}`)
      .filter((s) => s.split("\n").slice(1).join("").trim())
      .join("\n");
  }
  const raw = (req.lyrics ?? "").replace(/\[[^\]]{1,40}\]/g, " ").replace(/ {2,}/g, " ").trim();
  return raw ? `[Verse]\n${raw}` : "";
}

const TTS_MODEL = process.env.MINIMAX_TTS_MODEL ?? "speech-02-hd";

/**
 * نطق MiniMax 💠 «المحرك الاقتصادي» — Speech-02 HD بتعزيز عربي:
 * يُخصم من نقاط اشتراك MiniMax الشهرية (شبه مجانية) بدل رصيد ElevenLabs،
 * فيناسب النصوص الطويلة والمعاينات. وسوم المخرج التعبيري لغة ElevenLabs
 * حصراً فتُنزع قبل الإرسال كي لا تُقرأ حرفياً.
 */
export function minimaxTTS(apiKey: string, groupId: string): TTSProvider {
  return {
    id: "minimax",
    async synthesize(req: TTSRequest): Promise<AudioResult> {
      const voice = VOICES.find((v) => v.id === req.voiceId);
      const text = stripAudioTags(req.text).replace(/ {2,}/g, " ").trim();
      if (!text) throw new MinimaxError("النص فارغ بعد تنقية الوسوم", 400);

      const res = await fetch(
        `https://api.minimax.io/v1/t2a_v2?GroupId=${encodeURIComponent(groupId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: TTS_MODEL,
            text,
            stream: false,
            language_boost: "Arabic",
            voice_setting: {
              voice_id: voice?.minimaxVoiceId ?? "Wise_Woman",
              speed: Math.min(2, Math.max(0.5, req.speed ?? 1)),
            },
            audio_setting: {
              format: req.format === "wav" ? "wav" : "mp3",
              sample_rate: 32000,
              bitrate: 128000,
            },
          }),
        }
      );

      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new MinimaxError(`MiniMax TTS ${res.status}: ${detail}`, res.status);
      }

      const json = await res.json();
      const code: number = json?.base_resp?.status_code ?? -1;
      if (code !== 0) {
        const msg: string = json?.base_resp?.status_msg ?? "unknown";
        throw new MinimaxError(
          /insufficient|limit reached/i.test(msg)
            ? "نفدت نقاط اشتراك MiniMax الصوتية لهذا الشهر — جرّب صوتاً من محرك آخر"
            : `MiniMax TTS (${code}): ${msg}`,
          code
        );
      }

      const hex: string | undefined = json?.data?.audio;
      if (!hex) throw new MinimaxError("لم تتضمن استجابة MiniMax صوتاً", 502);

      return {
        audio: Buffer.from(hex, "hex"),
        mimeType: req.format === "wav" ? "audio/wav" : "audio/mpeg",
        provider: "minimax",
      };
    },
  };
}

export function minimaxMusic(apiKey: string, groupId: string): MusicProvider {
  return {
    id: "minimax",
    async generate(req: MusicRequest): Promise<AudioResult> {
      const instrumentalOnly = isInstrumentalRequest(req);
      const lyrics = buildLyrics(req).slice(0, 3000);

      const prompt = [
        req.stylePrompt,
        ...(req.bpm ? [`Tempo: ${req.bpm} BPM.`] : []),
        instrumentalOnly
          ? "Instrumental only, no vocals."
          : [
              req.singer ? `${req.singer} Arabic lead vocals.` : "Arabic lead vocals.",
              req.dialectEn
                ? `Authentic ${req.dialectEn}, native-speaker pronunciation.`
                : "Native Arabic pronunciation.",
            ].join(" "),
      ]
        .filter(Boolean)
        .join("\n")
        // حد برومبت الأسلوب لدى المحرك — الفائض يُقص من الذيل لا من المقام
        .slice(0, 1800);

      const res = await fetch(
        `https://api.minimax.io/v1/music_generation?GroupId=${encodeURIComponent(groupId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: MODEL,
            prompt,
            ...(instrumentalOnly ? { is_instrumental: true } : { lyrics }),
            audio_setting: { format: "mp3", sample_rate: 44100, bitrate: 256000 },
            output_format: "hex",
          }),
        }
      );

      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        throw new MinimaxError(`MiniMax ${res.status}: ${detail}`, res.status);
      }

      const json = await res.json();
      const code: number = json?.base_resp?.status_code ?? -1;
      if (code !== 0) {
        const msg: string = json?.base_resp?.status_msg ?? "unknown";
        // 1008: رصيد الدفع-حسب-الاستخدام فارغ — الموسيقى لا تُخصم من نقاط الاشتراك
        const needsTopUp = code === 1008 || /insufficient balance/i.test(msg);
        throw new MinimaxError(
          needsTopUp
            ? "توليد الموسيقى عبر MiniMax يتطلب شحن رصيد Pay-as-you-go في حساب المنصة (قسم Balance)"
            : `MiniMax (${code}): ${msg}`,
          code,
          needsTopUp
        );
      }

      const hex: string | undefined = json?.data?.audio;
      if (!hex) throw new MinimaxError("لم تتضمن استجابة MiniMax أي مقطع صوتي", 502);

      return { audio: Buffer.from(hex, "hex"), mimeType: "audio/mpeg", provider: "minimax" };
    },
  };
}
