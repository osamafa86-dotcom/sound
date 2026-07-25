import { elevenLabsMusic, elevenLabsTTS } from "./elevenlabs";
import { azureTTS } from "./azure";
import { lyriaMusic } from "./lyria";
import { mockMusic, mockTTS } from "./mock";
import { VOICES } from "@/lib/voices";
import type { MusicProvider, TTSProvider } from "./types";

/**
 * اختيار المزوّد حسب المفاتيح المتوفرة في البيئة:
 * وجود المفتاح يفعّل المحرك الحقيقي، وغيابه يعيد الوضع التجريبي.
 * المسارات (routes) تتكفل بالرجوع للوضع التجريبي إذا فشل المحرك الحقيقي.
 */
export function getTTSProvider(voiceId?: string): TTSProvider {
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
 * توزيع توليد الموسيقى حسب استراتيجية الخطة:
 * - المعاينة السريعة → Lyria Clip (30 ثانية، الأرخص)
 * - الموسيقى الآلية الكاملة → Lyria Pro (الغناء العربي غير مدعوم في Lyria بعد)
 * - الأغنية المغنّاة الكاملة → Eleven Music
 * مع التدرج للمتوفر من المفاتيح، وأخيراً الوضع التجريبي.
 */
export function getMusicProvider(opts?: { tier?: "preview" | "full"; instrumental?: boolean }): MusicProvider {
  const gemini = process.env.GEMINI_API_KEY;
  const eleven = process.env.ELEVENLABS_API_KEY;

  if (opts?.tier === "preview" && gemini) return lyriaMusic(gemini, "clip");
  if (opts?.instrumental && gemini) return lyriaMusic(gemini, "pro");
  if (eleven) return elevenLabsMusic(eleven);
  if (gemini) return lyriaMusic(gemini, opts?.tier === "preview" ? "clip" : "pro");
  return mockMusic;
}

export { mockMusic, mockTTS };
