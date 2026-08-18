/**
 * 🌍 الدبلجة — كتالوج اللغات المشترك بين الواجهة والخادم.
 *
 * الدبلجة تنقل العمل الصوتي (أو الفيديو) إلى لغة أخرى مع الحفاظ على
 * طابع صوت المتحدث الأصلي وأدائه وتوقيته. الرموز كما يتوقعها محرك
 * ElevenLabs Dubbing، والأسماء عربية للعرض.
 */

export type DubLanguage = { code: string; name: string; flag: string };

/** اللغات الهدف المدعومة — العربية بينها لدبلجة الأعمال الأجنبية إليها */
export const DUB_TARGETS: DubLanguage[] = [
  { code: "en", name: "الإنجليزية", flag: "🇬🇧" },
  { code: "tr", name: "التركية", flag: "🇹🇷" },
  { code: "fr", name: "الفرنسية", flag: "🇫🇷" },
  { code: "es", name: "الإسبانية", flag: "🇪🇸" },
  { code: "de", name: "الألمانية", flag: "🇩🇪" },
  { code: "it", name: "الإيطالية", flag: "🇮🇹" },
  { code: "pt", name: "البرتغالية", flag: "🇵🇹" },
  { code: "ru", name: "الروسية", flag: "🇷🇺" },
  { code: "uk", name: "الأوكرانية", flag: "🇺🇦" },
  { code: "hi", name: "الهندية", flag: "🇮🇳" },
  { code: "id", name: "الإندونيسية", flag: "🇮🇩" },
  { code: "ja", name: "اليابانية", flag: "🇯🇵" },
  { code: "ko", name: "الكورية", flag: "🇰🇷" },
  { code: "zh", name: "الصينية", flag: "🇨🇳" },
  { code: "ar", name: "العربية", flag: "🌙" },
];

/** لغات المصدر — الاكتشاف التلقائي أولاً وهو الافتراضي الأسلم */
export const DUB_SOURCES: DubLanguage[] = [
  { code: "auto", name: "اكتشاف تلقائي", flag: "🔍" },
  ...DUB_TARGETS,
];

export function dubLanguageName(code: string): string {
  return DUB_TARGETS.find((l) => l.code === code)?.name ?? code;
}

export function isDubTarget(code: string): boolean {
  return DUB_TARGETS.some((l) => l.code === code);
}

export function isDubSource(code: string): boolean {
  return DUB_SOURCES.some((l) => l.code === code);
}

/** سقف حجم ملف المصدر — يوازي حد عازل الصوت القائم */
export const DUB_MAX_BYTES = 25 * 1024 * 1024;

/** حالة مشروع الدبلجة لدى المحرك */
export type DubStatus = "dubbing" | "dubbed" | "failed";
