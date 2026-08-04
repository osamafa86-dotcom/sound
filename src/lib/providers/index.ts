import { elevenLabsMusic, elevenLabsTTS } from "./elevenlabs";
import { azureTTS } from "./azure";
import { lyriaMusic } from "./lyria";
import { minimaxMusic } from "./minimax";
import { mockMusic, mockTTS } from "./mock";
import { VOICES } from "@/lib/voices";
import { settingsSnapshot } from "@/lib/platformSettings";
import type { MusicProvider, TTSProvider } from "./types";

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
 * مزوّد الأغاني — قرار المالك (آب 2026) بعد التحكيم بالسمع عبر توليدات كثيرة:
 * **Lyria حصراً** (أعلى وأقوى من Eleven Music في الأغاني) بلا سلسلة رجوع بينهما —
 * ما يرفضه مرشّح المحتوى يخرج سلّم مقام تجريبياً بسبب معروض لا أغنيةً من محرك أدنى.
 * مهارب الرجوع: MUSIC_PROVIDER=elevenlabs يعيد Eleven، وEleven يبقى ملاذاً
 * تلقائياً فقط عند غياب مفتاح Gemini كلياً (حماية استمرارية المنصة).
 * (مستوى المعاينة يتحكم بالمدة عبر durationSec في الطلب نفسه)
 */
export function getMusicProvider(opts?: {
  tier?: "preview" | "full";
  instrumental?: boolean;
  /** فرض محرك مهمة بعينها — وضع المقارنة واختيار البطاقة */
  force?: "lyria" | "eleven-music" | "minimax";
}): MusicProvider {
  if (settingsSnapshot().forceMock) return mockMusic;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const minimaxKey = process.env.MINIMAX_API_KEY;
  const minimaxGroup = process.env.MINIMAX_GROUP_ID;
  const forced = process.env.MUSIC_PROVIDER;

  const eleven = elevenKey ? elevenLabsMusic(elevenKey) : null;
  const lyria = geminiKey ? lyriaMusic(geminiKey) : null;
  // MiniMax Music: حُكم المالك بالسمع (آب 2026) — الغناء العربي ضعيف جداً،
  // فأُزيل من واجهة الاختيار كلياً ويبقى هنا للتجارب عبر force/MUSIC_PROVIDER فقط
  const minimax = minimaxKey && minimaxGroup ? minimaxMusic(minimaxKey, minimaxGroup) : null;

  // فرض المهمة الواحدة (المقارنة) يتقدم على كل شيء — كل نسخة بمحركها الحقيقي
  if (opts?.force === "eleven-music" && eleven) return eleven;
  if (opts?.force === "lyria" && lyria) return lyria;
  if (opts?.force === "minimax" && minimax) return minimax;

  if (forced === "elevenlabs" && eleven) return eleven;
  if (forced === "minimax" && minimax) return minimax;

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

export { mockMusic, mockTTS };
