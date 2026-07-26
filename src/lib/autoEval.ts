import { MAQAMAT } from "./maqamat";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { consumeRateLimit } from "./rateLimit";
import { elevenLabsTranscribe } from "./providers/elevenlabs";
import { pronunciationAccuracy } from "./textCompare";

/**
 * النقد الذاتي — العقل يقيّم نواتجه بنفسه دون انتظار نجوم المستخدمين:
 * - الأصوات: تفريغ الناتج عبر Scribe ومقارنته بالنص (دقة نطق 0..1)
 * - الأغاني: حكم Gemini الصوتي على التزام المقام وجودة الإنتاج
 *
 * ضوابط الكلفة: عيّنات (1 من كل N) + سقف يومي عالمي + حد طول النص،
 * وكل شيء «أطلق وانسَ» لا يبطئ استجابة المستخدم أبداً.
 */

export const TTS_SAMPLE_ONE_IN = 5;
export const SONG_SAMPLE_ONE_IN = 3;
/** أقصى طول نص يخضع للنقد (تفريغ الدقائق الطويلة مكلف) */
const TTS_MAX_CHARS = 600;
const DAILY_TTS_EVALS = 60;
const DAILY_SONG_EVALS = 40;

function disabled(): boolean {
  return process.env.BRAIN_DISABLED === "1";
}

export function sampleOneIn(n: number): boolean {
  return Math.random() * n < 1;
}

/** نقد صوت TTS: تفريغ الناتج ومقارنته بالنص الأصلي */
export async function autoEvalTTS(opts: {
  apiKey: string;
  text: string;
  audio: Buffer;
  mimeType: string;
  voiceId: string;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || disabled()) return;
  // أصوات المستخدمين الخاصة (مستنسخة/مصممة) خارج الترتيب العام
  if (opts.voiceId.startsWith("clone-") || opts.voiceId.startsWith("custom:")) return;
  if (opts.text.length > TTS_MAX_CHARS) return;
  if (!(await consumeRateLimit("autoEval:tts:global", DAILY_TTS_EVALS, 24 * 3600))) return;

  try {
    const transcript = await elevenLabsTranscribe(
      opts.apiKey,
      new Blob([new Uint8Array(opts.audio)], { type: opts.mimeType })
    );
    const score = pronunciationAccuracy(opts.text, transcript);
    if (score === null) return;
    const { error } = await admin.from("auto_evals").insert({
      kind: "tts",
      voice_id: opts.voiceId,
      score,
      meta: { chars: opts.text.length },
    });
    if (error) console.error("auto_evals insert failed:", error.message);
  } catch (e) {
    console.error("autoEvalTTS failed:", e instanceof Error ? e.message : e);
  }
}

const JUDGE_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    maqamAdherence: { type: "number", description: "0-10: هل الموسيقى ملتزمة فعلاً بالمقام المطلوب وطابعه؟" },
    productionQuality: { type: "number", description: "0-10: نظافة الإنتاج والتوازن والاتساق" },
    note: { type: "string", description: "ملاحظة عربية موجزة في جملة" },
  },
  required: ["maqamAdherence", "productionQuality", "note"],
  propertyOrdering: ["maqamAdherence", "productionQuality", "note"],
};

/** نقد أغنية: Gemini يستمع ويحكم على الالتزام المقامي وجودة الإنتاج */
export async function autoEvalSong(opts: {
  geminiKey: string;
  audio: Buffer;
  mimeType: string;
  maqamId: string;
  variantId?: number;
}): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin || disabled()) return;
  // الملفات الأكبر من ~12MB تتجاوز حد الإدراج المضمّن بعد الترميز
  if (opts.audio.length > 12 * 1024 * 1024) return;
  if (!(await consumeRateLimit("autoEval:song:global", DAILY_SONG_EVALS, 24 * 3600))) return;

  const maqam = MAQAMAT.find((m) => m.id === opts.maqamId);
  if (!maqam) return;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${JUDGE_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": opts.geminiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { mimeType: opts.mimeType, data: opts.audio.toString("base64") } },
                {
                  text: `أنت ناقد موسيقي خبير في المقامات العربية. استمع للمقطوعة واحكم:
1. الالتزام المقامي: المطلوب مقام ${maqam.name} — طابعه «${maqam.mood}». هل السلّم والمزاج والعبارات اللحنية تنتمي إليه فعلاً (بما في ذلك أرباع النغمات إن كانت من طبيعته)؟
2. جودة الإنتاج: النظافة والتوازن والاتساق الإيقاعي.
كن صارماً — الدرجات العالية للأعمال المقنعة فعلاً.`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: JUDGE_SCHEMA,
            temperature: 0.2,
            maxOutputTokens: 1024,
          },
        }),
      }
    );
    if (!res.ok) {
      console.error("autoEvalSong Gemini error:", res.status);
      return;
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return;
    const verdict = JSON.parse(text) as {
      maqamAdherence: number;
      productionQuality: number;
      note: string;
    };
    const adherence = Math.min(10, Math.max(0, Number(verdict.maqamAdherence) || 0));
    const quality = Math.min(10, Math.max(0, Number(verdict.productionQuality) || 0));

    const { error } = await admin.from("auto_evals").insert({
      kind: "song",
      maqam_id: opts.maqamId,
      variant_id: opts.variantId ?? null,
      score: (adherence + quality) / 20,
      meta: { adherence, quality, note: String(verdict.note ?? "").slice(0, 300) },
    });
    if (error) console.error("auto_evals insert failed:", error.message);
  } catch (e) {
    console.error("autoEvalSong failed:", e instanceof Error ? e.message : e);
  }
}
