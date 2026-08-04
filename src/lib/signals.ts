import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * حواس العقل — الإشارات الضمنية: كل تفاعل ذي معنى يتحول وقود تعلم
 * دون انتظار نجوم التقييم. الوزن موجب رضاً وسالب نفوراً.
 */

export const SIGNAL_WEIGHTS = {
  /** استمع للناتج حتى نهايته */
  played_to_end: 1,
  /** أعاد تشغيل الناتج بعد اكتماله */
  replayed: 1.5,
  /** نزّل الملف */
  downloaded: 2,
  /** حفظ في مكتبته */
  saved: 2.5,
  /** نسخ رابط المشاركة */
  shared: 3,
  /** طلب نسخة أخرى — عدم رضا خفيف عن السابقة */
  regenerated: -0.5,
  /** أعاد توليد مقطعاً بعينه — نفور موجّه */
  section_regen: -1,
  /** اختار هذه النسخة من بين عدة نسخ */
  version_chosen: 2,
  /** نسخة خسرت المقارنة أمام المختارة */
  version_rejected: -1,
  /**
   * نسبة مطابقة الغناء للنص مقيسة آلياً (meta.percent) — وزن صفري:
   * مقياس موضوعي يُقرأ في التحليلات لا حكم رضا يدخل درجات السلالات
   * (تحمل settings.engine دوماً فتُستبعد من إسناد الإشارات للسلالات)
   */
  adherence: 0,
} as const;

export type SignalKind = keyof typeof SIGNAL_WEIGHTS;

export type SignalInput = {
  kind: SignalKind;
  voiceId?: string;
  maqamId?: string;
  settings?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

/** تسجيل إشارة — لا يعطّل الطلب أبداً */
export async function recordSignal(input: SignalInput, userId: string | null): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.from("signals").insert({
    user_id: userId,
    kind: input.kind,
    weight: SIGNAL_WEIGHTS[input.kind],
    voice_id: input.voiceId ?? null,
    maqam_id: input.maqamId ?? null,
    settings: input.settings ?? null,
    meta: input.meta ?? null,
  });
  if (error) console.error("signal insert failed:", error.message);
}
