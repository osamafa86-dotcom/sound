import { elevenLabsMusic, elevenLabsTTS } from "./elevenlabs";
import { lyriaMusic } from "./lyria";
import { mockMusic, mockTTS } from "./mock";
import type { AudioResult, MusicProvider, MusicRequest, TTSProvider } from "./types";

/**
 * اختيار مزوّد النطق: ELEVENLABS_API_KEY يفعّل المحرك الحقيقي، وغيابه يعيد الوضع التجريبي.
 * المسارات (routes) تتكفل بالرجوع للوضع التجريبي إذا فشل المحرك الحقيقي.
 */
export function getTTSProvider(): TTSProvider {
  const key = process.env.ELEVENLABS_API_KEY;
  return key ? elevenLabsTTS(key) : mockTTS;
}

/**
 * مزوّد الموسيقى المفضّل: Lyria 3 Pro (أرخص وأعلى جودة) مع رجوع تلقائي إلى Eleven Music
 * عند تعذّره — مثل نفاد الحصة أو غياب الفوترة في Google Cloud.
 * يمكن فرض مزوّد بعينه عبر MUSIC_PROVIDER=lyria|elevenlabs.
 */
export function getMusicProvider(): MusicProvider {
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const forced = process.env.MUSIC_PROVIDER;

  const eleven = elevenKey ? elevenLabsMusic(elevenKey) : null;
  const lyria = geminiKey ? lyriaMusic(geminiKey) : null;

  if (forced === "elevenlabs" && eleven) return eleven;
  if (forced === "lyria" && lyria) return lyria;

  if (lyria && eleven) return withFallback(lyria, eleven);
  return lyria ?? eleven ?? mockMusic;
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
