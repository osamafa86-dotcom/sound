import { elevenLabsMusic, elevenLabsTTS } from "./elevenlabs";
import { mockMusic, mockTTS } from "./mock";
import type { MusicProvider, TTSProvider } from "./types";

/**
 * اختيار المزوّد حسب المفاتيح المتوفرة في البيئة:
 * وجود ELEVENLABS_API_KEY يفعّل المحرك الحقيقي، وغيابه يعيد الوضع التجريبي.
 * المسارات (routes) تتكفل بالرجوع للوضع التجريبي إذا فشل المحرك الحقيقي.
 */
export function getTTSProvider(): TTSProvider {
  const key = process.env.ELEVENLABS_API_KEY;
  return key ? elevenLabsTTS(key) : mockTTS;
}

export function getMusicProvider(): MusicProvider {
  const key = process.env.ELEVENLABS_API_KEY;
  return key ? elevenLabsMusic(key) : mockMusic;
}

export { mockMusic, mockTTS };
