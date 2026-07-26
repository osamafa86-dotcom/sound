import { MAQAMAT } from "./maqamat";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * سلالات البرومبتات المتنافسة — التطور الذاتي لهوية كل مقام.
 *
 * برومبت المقام لم يعد نصاً ثابتاً في الكود بل سلالات في القاعدة تتنافس:
 * الاختيار epsilon-greedy (استغلال الأفضل + استكشاف محسوب)، والنتائج
 * تُعتمد من النقد الذاتي والإشارات، وجلسة التأمل تولّد سلالات جديدة.
 *
 * حواجز أمان: برومبت الكود يبقى الملاذ الدائم، والسلالة البذرة لا تُعطَّل،
 * ولا حكم على سلالة قبل حد أدنى من الأدلة.
 */

export type PromptVariantRow = {
  id: number;
  maqam_id: string;
  prompt: string;
  source: string;
  active: boolean;
  uses: number;
  score_sum: number;
  score_count: number;
};

/** نسبة الاستكشاف بين السلالات الناضجة */
const EXPLORE_RATE = 0.15;
/** الحد الأدنى من الأدلة قبل الوثوق بمتوسط سلالة */
export const MIN_EVALS_TO_TRUST = 4;
/** أقصى عدد سلالات نشطة لكل مقام */
export const MAX_ACTIVE_VARIANTS = 4;

/** متوسط سلالة — المجهولة تبدأ متفائلة حيادياً (0.5) */
export function variantAvg(v: Pick<PromptVariantRow, "score_sum" | "score_count">): number {
  return v.score_count > 0 ? v.score_sum / v.score_count : 0.5;
}

/**
 * اختيار برومبت المقام لتوليدة واحدة:
 * سلالة غير مجرَّبة تأخذ نصف فرص الظهور حتى تنضج، ثم الأفضل متوسطاً
 * مع استكشاف 15٪ — وبرومبت الكود عند غياب القاعدة أو السلالات.
 */
export async function pickMaqamPrompt(
  maqamId: string
): Promise<{ prompt: string; variantId?: number }> {
  const fallback = { prompt: MAQAMAT.find((m) => m.id === maqamId)?.stylePrompt ?? "" };
  if (process.env.BRAIN_DISABLED === "1") return fallback;
  const admin = getSupabaseAdmin();
  if (!admin) return fallback;

  const { data, error } = await admin
    .from("prompt_variants")
    .select("*")
    .eq("maqam_id", maqamId)
    .eq("active", true);
  if (error || !data?.length) return fallback;

  const variants = data as PromptVariantRow[];
  const fresh = variants.filter((v) => v.score_count < MIN_EVALS_TO_TRUST);

  let chosen: PromptVariantRow;
  if (fresh.length && Math.random() < 0.5) {
    chosen = fresh[Math.floor(Math.random() * fresh.length)];
  } else if (Math.random() < EXPLORE_RATE) {
    chosen = variants[Math.floor(Math.random() * variants.length)];
  } else {
    chosen = [...variants].sort((a, b) => variantAvg(b) - variantAvg(a))[0];
  }

  // عدّاد الاستخدام — بلا انتظار ولا كسر للطلب
  admin
    .from("prompt_variants")
    .update({ uses: chosen.uses + 1 })
    .eq("id", chosen.id)
    .then(({ error: e }) => {
      if (e) console.error("variant uses update failed:", e.message);
    });

  return { prompt: chosen.prompt, variantId: chosen.id };
}

/** إسهام إشارة ضمنية في درجة سلالة (0..1): الوزن ±3 → حول الوسط 0.5 */
export function signalContribution(weight: number): number {
  return Math.max(0, Math.min(1, 0.5 + weight / 6));
}
