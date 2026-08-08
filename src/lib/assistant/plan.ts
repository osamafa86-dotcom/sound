import { DIALECTS, INSTRUMENTS, SONG_STYLES } from "@/lib/maqamat";
import { parseSections, sanitizeSections, type SongSection } from "@/lib/songSections";
import type { MusicPlan } from "./types";

/**
 * الخطة الذكية المشتركة بين مزوّدي المساعد (Claude / Gemini):
 * جزء المخطط والتوجيه اللذان يُلزمان النموذج بتقرير التلحين كاملاً،
 * ثم تعقيم ما يعود منه ضد كتالوجات المنصة قبل الوثوق به.
 */

/** خصائص حقل plan في مخطط JSON — تُدمج في مخطط كل مزوّد بصيغته */
export function planSchemaProps() {
  return {
    styleId: {
      type: "string",
      enum: SONG_STYLES.map((s) => s.id),
      description: "اللون الغنائي الأنسب لمعنى الكلمات ومزاجها",
    },
    singer: { type: "string", enum: ["male", "female"], description: "جنس صوت الغناء الأنسب" },
    dialectId: {
      type: "string",
      enum: DIALECTS.map((d) => d.id),
      description: "اللهجة — إن أرسل المستخدم كلماته فاستنتجها من النص نفسه",
    },
    instrumentIds: {
      type: "array",
      items: { type: "string", enum: INSTRUMENTS.map((i) => i.id) },
      description: "2 إلى 5 آلات تخدم اللون المختار",
    },
    bpm: { type: "number", description: "سرعة الإيقاع 60–140، أو 0 لتركها لتقدير المحرك" },
    reason: {
      type: "string",
      description: "تعليل عربي موجز (جملتان إلى ثلاث) يشرح للمستخدم كل قرارات الخطة معاً",
    },
  };
}

/** السطر الذي يُضاف لتعليمات النظام في الوضع الذكي */
export const PLAN_PROMPT_LINE = `5. بصفتك المنتج الموسيقي، قرر خطة التلحين كاملة في حقل plan: اللون الغنائي الأنسب (styleId)، جنس الصوت (singer)، اللهجة (dialectId — وإن أرسل المستخدم كلماته الجاهزة فاستنتج لهجتها من النص نفسه)، من آلتين إلى خمس آلات (instrumentIds)، والسرعة bpm (60–140، أو 0 لتركها للمحرك)، مع تعليل عربي واحد موجز (reason) يشرح للمستخدم لماذا اخترت هذا كله.`;

/** هيكل الحروف: بلا حركات ولا ترقيم ولا مسافات — معيار «نفس الكلمات حرفياً» */
function letterSkeleton(text: string): string {
  return text.replace(/[ً-ْٰـ]/g, "").replace(/[^\p{L}\p{N}]+/gu, "");
}

/**
 * مقاطع وضع «كلماتي جاهزة»: بنية النموذج (مقدمة/مقاطع/لازمة/خاتمة بمددها)
 * مكسب موسيقي حقيقي — لكنها تُقبل فقط إن حملت كلمات المستخدم نفسها
 * (هيكل الحروف متطابق؛ التشكيل المضاف مسموح لأنه عون نطق لا تعديل).
 * وإلا فالتقسيم الاستدلالي من نص المستخدم الحرفي هو المرجع.
 */
export function verbatimSections(
  userLyrics: string,
  modelSections: SongSection[] | undefined | null
): SongSection[] {
  const sane = sanitizeSections(modelSections ?? undefined);
  if (sane && letterSkeleton(sane.map((s) => s.lyrics).join(" ")) === letterSkeleton(userLyrics)) {
    return sane;
  }
  return parseSections(userLyrics);
}

/** تعقيم خطة النموذج ضد الكتالوجات — أي قيمة خارجة تُستبدل بأقرب افتراض آمن */
export function sanitizePlan(raw: unknown): MusicPlan | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const p = raw as Record<string, unknown>;

  const styleId = SONG_STYLES.some((s) => s.id === p.styleId)
    ? (p.styleId as string)
    : SONG_STYLES[0].id;
  const dialectId = DIALECTS.some((d) => d.id === p.dialectId)
    ? (p.dialectId as string)
    : DIALECTS[0].id;
  const singer = p.singer === "male" ? "male" : "female";

  const instrumentIds = (Array.isArray(p.instrumentIds) ? p.instrumentIds : [])
    .filter((id): id is string => INSTRUMENTS.some((i) => i.id === id))
    .slice(0, 5);

  const bpmRaw = typeof p.bpm === "number" && Number.isFinite(p.bpm) ? Math.round(p.bpm) : 0;
  const bpm = bpmRaw >= 40 ? Math.min(200, Math.max(40, bpmRaw)) : null;

  return {
    styleId,
    singer,
    dialectId,
    instrumentIds: instrumentIds.length ? instrumentIds : ["oud", "qanun", "darbuka"],
    bpm,
    reason: typeof p.reason === "string" ? p.reason.slice(0, 600) : "",
  };
}
