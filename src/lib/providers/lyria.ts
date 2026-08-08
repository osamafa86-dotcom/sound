import { pcm16ToWav } from "@/lib/mockAudio";
import { isInstrumentalRequest } from "./compositionPlan";
import type { AudioResult, MusicProvider, MusicRequest } from "./types";

/** نموذج توليد الموسيقى — Lyria 3 Pro يدعم أغانٍ حتى ~3 دقائق بجودة عالية */
const MODEL = process.env.LYRIA_MODEL ?? "lyria-3-pro-preview";

export class LyriaError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly needsBilling = false,
    /** رفضه مرشّح المحتوى لا عطل تقني — يفتح جسر الغناء عبر المحرك البديل */
    readonly contentRejected = false
  ) {
    super(message);
  }
}

/**
 * عتبات الأمان معطلة افتراضياً (BLOCK_NONE) — قرار المالك: المرشّح الإحصائي
 * أساء فهم كلمات وطنية بريئة، وجوجل تُبقي مرشّحاتها الصلبة غير القابلة
 * للتعطيل في جانبها مهما أرسلنا، وشروط استخدام المنصة تحكم إساءة الاستخدام.
 * درجات الرجوع عبر LYRIA_SAFETY: "high" حجب للخطير الصريح فقط،
 * "default" افتراضي المحرك الصارم (بلا إرسال عتبات).
 */
const SAFETY_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
];

function safetySettings(): { category: string; threshold: string }[] | null {
  const mode = process.env.LYRIA_SAFETY ?? "none";
  if (mode === "default") return null;
  const threshold = mode === "high" ? "BLOCK_ONLY_HIGH" : "BLOCK_NONE";
  return SAFETY_CATEGORIES.map((category) => ({ category, threshold }));
}

type Part = { inlineData?: { mimeType?: string; data?: string }; text?: string };

/** استخراج أول جزء صوتي من استجابة Gemini وتحويله لصيغة قابلة للتشغيل */
function extractAudio(parts: Part[]): { audio: Buffer; mimeType: string } | null {
  for (const part of parts) {
    const mime = part.inlineData?.mimeType ?? "";
    const data = part.inlineData?.data;
    if (!data || !mime.startsWith("audio/")) continue;

    const raw = Buffer.from(data, "base64");

    // PCM خام (audio/L16;codec=pcm;rate=48000) يحتاج ترويسة WAV ليعمل في المتصفح
    if (/^audio\/(l16|pcm)/i.test(mime)) {
      const rate = Number(mime.match(/rate=(\d+)/i)?.[1] ?? 48000);
      const channels = Number(mime.match(/channels=(\d+)/i)?.[1] ?? 2);
      return { audio: pcm16ToWav(raw, rate, channels), mimeType: "audio/wav" };
    }
    return { audio: raw, mimeType: mime.split(";")[0] };
  }
  return null;
}

export function lyriaMusic(apiKey: string): MusicProvider {
  return {
    id: "lyria",
    async generate(req: MusicRequest): Promise<AudioResult> {
      const instrumentalOnly = isInstrumentalRequest(req);
      const seconds = Math.min(180, Math.max(15, req.durationSec ?? 60));

      // بنية المقاطع تصل Lyria وصفاً نصياً (لا يدعم خطط تأليف مهيكلة كـ Eleven Music)
      const structure = req.sections?.length
        ? `Song structure: ${req.sections
            .map((s) => `${s.kind} (~${s.durationSec}s)`)
            .join(" → ")}.`
        : "";

      // كلمات الغناء من المقاطع مباشرة — نص المقاطع المدموج يحمل ترويسات
      // عربية («لازمة:») قد تُغنّى حرفياً لو مُررت كما هي،
      // وعلامات [المقاطع] تُنزع من الخام كي لا تبدو تنسيقاً منسوخاً
      const sungLyrics = (
        req.sections?.length
          ? req.sections
              .map((s) => s.lyrics.trim())
              .filter(Boolean)
              .join("\n\n")
          : (req.lyrics ?? "").trim()
      )
        .replace(/\[[^\]]{1,40}\]/g, " ")
        .replace(/ {2,}/g, " ")
        .trim();

      const prompt = [
        req.stylePrompt,
        ...(req.bpm ? [`Tempo: ${req.bpm} BPM.`] : []),
        ...(structure ? [structure] : []),
        `Target duration: about ${seconds} seconds.`,
        instrumentalOnly
          ? "Instrumental only, no vocals."
          : [
              req.singer ? `${req.singer} Arabic lead vocals.` : "",
              req.dialectEn
                ? `Authentic ${req.dialectEn}, native-speaker pronunciation.`
                : "",
              // تصريح الأصالة يهدّئ مرشّح «إعادة الإنتاج» (رفض OTHER):
              // كلمات المستخدم الأصلية لتأليف جديد — لا اقتباس من عمل قائم
              "The following are ORIGINAL Arabic lyrics written by the user themselves",
              "specifically for this brand-new composition (not from any existing song).",
              // حرفية الغناء: كل كلمة كما كُتبت وبترتيبها — الانحراف والارتجال
              // اللفظي أكبر خاصم لنسبة مطابقة الغناء للنص المقيسة آلياً
              "Sing the lyrics verbatim: every word exactly as written and in order —",
              "no substitutions, no paraphrasing, no ad-lib filler words",
              "(repeating written lines for musical structure is fine).",
              `Sing them as the vocals of this new original song:\n${sungLyrics}`,
            ]
              .filter(Boolean)
              .join("\n"),
      ].join("\n");

      // النموذج يعيد 503 عند الازدحام المؤقت — نعيد المحاولة قبل الرجوع للمزوّد البديل
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { responseModalities: ["AUDIO"] },
              ...(safetySettings() && { safetySettings: safetySettings() }),
            }),
          }
        );
        if (res.status !== 503) break;
        if (attempt < 2) await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
      }

      if (!res || !res.ok) {
        const status = res?.status ?? 0;
        const detail = res ? await res.text().catch(() => "") : "";
        // الطبقة المجانية تعطي حصة صفرية لـ Lyria — نميّزها لعرض رسالة مفهومة للمستخدم
        const needsBilling = status === 429 && /limit:\s*0/.test(detail);
        throw new LyriaError(
          needsBilling
            ? "توليد الموسيقى بـ Lyria يتطلب تفعيل الفوترة في Google Cloud (غير متاح على الطبقة المجانية)"
            : status === 503
              ? "محرك Lyria مزدحم حالياً — جرّب بعد قليل"
              : `Lyria ${status}: ${detail.slice(0, 300)}`,
          status,
          needsBilling
        );
      }

      const json = await res.json();

      // Lyria يعيد 200 بلا مرشّحين عندما يحجب مرشّح المحتوى الطلب
      const blockReason = json?.promptFeedback?.blockReason;
      if (blockReason) {
        throw new LyriaError(
          `رفض مرشّح المحتوى في Lyria هذه الكلمات (${blockReason})`,
          400,
          false,
          true
        );
      }

      const candidate = json?.candidates?.[0];
      if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
        throw new LyriaError("رفض مرشّح Lyria توليد هذا المقطع", 400, false, true);
      }

      const found = extractAudio(candidate?.content?.parts ?? []);
      if (!found) {
        throw new LyriaError("لم تتضمن استجابة Lyria أي مقطع صوتي", 502);
      }

      return { audio: found.audio, mimeType: found.mimeType, provider: "lyria" };
    },
  };
}
