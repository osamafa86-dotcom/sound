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
}): string {
  const ai = opts.aiStylePrompt?.trim().slice(0, 700) ?? "";
  return [
    ...(ai ? [ai] : [opts.maqam.stylePrompt, opts.styleEn]),
    opts.instrumentsEn.join(", "),
    "high quality studio production",
  ]
    .filter(Boolean)
    .join(", ");
}
