import { elevenLabsMusic, elevenLabsTTS } from "./elevenlabs";
import { lyriaMusic } from "./lyria";
import { mockMusic, mockTTS } from "./mock";
import type { MusicProvider, TTSProvider } from "./types";

/**
 * اختيار المزوّد حسب المفاتيح المتوفرة في البيئة:
 * وجود المفتاح يفعّل المحرك الحقيقي، وغيابه يعيد الوضع التجريبي.
 * المسارات (routes) تتكفل بالرجوع للوضع التجريبي إذا فشل المحرك الحقيقي.
 */
export function getTTSProvider(): TTSProvider {
  const key = process.env.ELEVENLABS_API_KEY;
  return key ? elevenLabsTTS(key) : mockTTS;
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
