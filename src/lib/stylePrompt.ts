import type { Maqam } from "./maqamat";

/**
 * بناء البرومبت الموسيقي النهائي لمحرك التوليد:
 * برومبت Claude الاحترافي (من مساعد الكلمات) إن توفر يحل محل التركيب المحلي
 * من بيانات المقام والأسلوب، وتُلحق به آلات المستخدم المختارة دائماً.
 */
export function buildStylePrompt(opts: {
  maqam: Maqam;
  styleEn: string;
  instrumentsEn: string[];
  aiStylePrompt?: string;
  /** رقم النسخة البديلة (١ فأعلى) — يوجّه المحرك لتنويع التوزيع مع بقاء المقام والمزاج */
  variation?: number;
}): string {
  const ai = opts.aiStylePrompt?.trim().slice(0, 700) ?? "";
  return [
    ...(ai ? [ai] : [opts.maqam.stylePrompt, opts.styleEn]),
    opts.instrumentsEn.join(", "),
    "high quality studio production",
    ...(opts.variation
      ? [
          `alternate take ${opts.variation + 1}: different intro, varied arrangement and dynamics, same maqam and mood`,
        ]
      : []),
  ]
    .filter(Boolean)
    .join(", ");
}
