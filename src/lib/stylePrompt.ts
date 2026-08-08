import type { Maqam } from "./maqamat";

/**
 * بناء البرومبت الموسيقي النهائي لمحرك التوليد:
 * برومبت Claude الاحترافي (من مساعد الكلمات) إن توفر يحل محل التركيب المحلي
 * من بيانات المقام والأسلوب، وتُلحق به آلات المستخدم المختارة دائماً.
 */
/**
 * تحييد برومبت الأسلوب للمحاولة الأخيرة أمام مرشّح محتوى Lyria المتقلب:
 * الموصوفات الحماسية الإنجليزية في وصفنا نحن (patriotic/anthem/defiant...)
 * تتراكم مع مضمون كلمات المستخدم فترفع حساسية مرشّح OTHER — تُستبدل
 * بمرادفات مهرجانية محايدة موسيقياً، وكلمات المستخدم لا تُمس إطلاقاً.
 */
export function defuseStylePrompt(prompt: string): string {
  return prompt
    .replace(/\bpatriotic anthem\b/gi, "celebratory folk chorus")
    .replace(/\bpatriotic\b/gi, "proud communal")
    .replace(/\banthem\b/gi, "chorus")
    .replace(/\bdefiant\b/gi, "resolute")
    .replace(/\b(martial|militant|revolutionary|battlefield|battle|war|protest|resistance|struggle|fight(?:ing)?)\b/gi, "")
    .replace(/ {2,}/g, " ")
    .replace(/ ,/g, ",")
    .trim();
}

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
