import { elevenLabsMusic, elevenLabsTTS } from "./elevenlabs";
import { azureTTS } from "./azure";
import { lyriaMusic } from "./lyria";
import { mockMusic, mockTTS } from "./mock";
import { VOICES } from "@/lib/voices";
import { settingsSnapshot } from "@/lib/platformSettings";
import type { AudioResult, MusicProvider, MusicRequest, TTSProvider } from "./types";

/**
 * اختيار مزوّد النطق حسب الصوت المطلوب والمفاتيح المتوفرة:
 * أصوات Azure تتطلب مفتاحها، والبقية عبر ElevenLabs، وبلا مفاتيح يعود الوضع التجريبي.
 * المسارات (routes) تتكفل بالرجوع للوضع التجريبي إذا فشل المحرك الحقيقي.
 * ومفتاح «الوضع التجريبي القسري» في لوحة المالك يعطّل كل كلفة فوراً.
 */
export function getTTSProvider(voiceId?: string): TTSProvider {
  if (settingsSnapshot().forceMock) return mockTTS;
  const eleven = process.env.ELEVENLABS_API_KEY;
  const azureKey = process.env.AZURE_SPEECH_KEY;
  const azureRegion = process.env.AZURE_SPEECH_REGION;

  const voice = VOICES.find((v) => v.id === voiceId);
  if (voice?.provider === "azure" && azureKey && azureRegion) {
    return azureTTS(azureKey, azureRegion);
  }
  return eleven ? elevenLabsTTS(eleven) : mockTTS;
}

/** الأصوات المتاحة فعلياً حسب المفاتيح المضبوطة (بدون مفاتيح: الكل بوضع تجريبي) */
export function availableVoices() {
  const eleven = !!process.env.ELEVENLABS_API_KEY;
  const azure = !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
  if (!eleven && !azure) return VOICES;
  return VOICES.filter(
    (v) => (v.provider === "elevenlabs" && eleven) || (v.provider === "azure" && azure)
  );
}

/**
 * مزوّد الموسيقى المفضّل: Lyria 3 Pro (أرخص وأعلى جودة) مع رجوع تلقائي إلى Eleven Music
 * عند تعذّره — مثل نفاد الحصة أو حجب مرشّح المحتوى أو غياب الفوترة في Google Cloud.
 * يمكن فرض مزوّد بعينه عبر MUSIC_PROVIDER=lyria|elevenlabs.
 * (مستوى المعاينة يتحكم بالمدة عبر durationSec في الطلب نفسه)
 */
export function getMusicProvider(opts?: {
  tier?: "preview" | "full";
  instrumental?: boolean;
  /** فرض محرك مهمة بعينها — وضع المقارنة بين المحركين */
  force?: "lyria" | "eleven-music";
}): MusicProvider {
  if (settingsSnapshot().forceMock) return mockMusic;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const forced = process.env.MUSIC_PROVIDER;

  const eleven = elevenKey ? elevenLabsMusic(elevenKey) : null;
  const lyria = geminiKey ? lyriaMusic(geminiKey) : null;

  // فرض المهمة الواحدة (المقارنة) يتقدم على فرض البيئة — بلا سلسلة رجوع بين المحركين
  // كي تعكس كل نسخة محركها الحقيقي (الرجوع للوضع التجريبي يتكفل به منفّذ المهمة)
  if (opts?.force === "eleven-music" && eleven) return eleven;
  if (opts?.force === "lyria" && lyria) return lyria;

  if (forced === "elevenlabs" && eleven) return eleven;
  if (forced === "lyria" && lyria) return lyria;

  if (lyria && eleven) return withFallback(lyria, eleven);
  return lyria ?? eleven ?? mockMusic;
}

/** وضع المقارنة متاح فقط عندما يكون المحركان مفعّلين معاً ولا يفرض المالك الوضع التجريبي */
export function comparisonAvailable(): boolean {
  return (
    !settingsSnapshot().forceMock &&
    !!process.env.ELEVENLABS_API_KEY &&
    !!process.env.GEMINI_API_KEY
  );
}

/** يغلّف مزوّدين: يجرّب الأساسي ثم يعود للبديل مع تسجيل السبب */
function withFallback(primary: MusicProvider, backup: MusicProvider): MusicProvider {
  return {
    id: `${primary.id}+${backup.id}`,
    async generate(req: MusicRequest): Promise<AudioResult> {
      try {
        return await primary.generate(req);
      } catch (e) {
        const reason = e instanceof Error ? e.message : "unknown";
        console.warn(`music provider ${primary.id} failed, falling back to ${backup.id}: ${reason}`);
        const result = await backup.generate(req);
        return { ...result, fallbackFrom: primary.id, fallbackReason: reason };
      }
    },
  };
}

export { mockMusic, mockTTS };
