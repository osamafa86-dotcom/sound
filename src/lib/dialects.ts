import { VOICES, type Voice } from "@/lib/voices";

/**
 * اللهجة في الاستوديوهين الحواريين تحكم أمرين معاً:
 * 1. **الكتابة** — بأي لهجة يُكتب الحوار
 * 2. **الإلقاء** — من أي لهجة تُختار الأصوات
 *
 * فصلهما يُنتج نصاً فلسطينياً بصوت مصري — وهذه الوحدة تمنع ذلك.
 */

export const ANY_DIALECT = "الكل";

/** اللهجات التي يتوفر لها صوتان فأكثر — لتغطية شخصيات متعددة */
export const DIALECT_OPTIONS: string[] = [
  ANY_DIALECT,
  ...[...new Set(VOICES.map((v) => v.dialect))]
    .filter((d) => VOICES.filter((v) => v.dialect === d).length >= 2)
    .sort((a, b) => {
      // الفصحى أولاً ثم الشامية (الأكثر طلباً) ثم الباقي أبجدياً
      const rank = (d: string) => (d === "فصحى" ? 0 : ["فلسطينية", "أردنية", "شامية", "سورية", "لبنانية"].includes(d) ? 1 : 2);
      return rank(a) - rank(b) || a.localeCompare(b, "ar");
    }),
];

/**
 * الأصوات المتاحة للسيناريو حسب اللهجة المختارة.
 * نُبقي الفصحى متاحة دائماً مع أي لهجة، لأن النمط الطبيعي في الدراما العربية
 * سردٌ بالفصحى وحوارٌ بالعامية — ولا نريد حرمان المخرج من هذا الخيار.
 */
export function voicesForDialect(dialect?: string): Voice[] {
  if (!dialect || dialect === ANY_DIALECT) return VOICES;

  const matching = VOICES.filter((v) => v.dialect === dialect || v.dialect === "فصحى");
  return matching.length >= 2 ? matching : VOICES;
}

/** سطر التوجيه الذي يُحقن في برومبت الكتابة */
export function dialectInstruction(dialect?: string): string {
  if (!dialect || dialect === ANY_DIALECT) {
    return "اكتب بالأسلوب الأنسب للنص: الفصحى للسرد الرسمي، والعامية المناسبة للحوار الطبيعي.";
  }
  if (dialect === "فصحى") {
    return "اكتب كل النص بالفصحى السليمة — سرداً وحواراً.";
  }
  return `اكتب الحوار باللهجة ${dialect} بمفرداتها وتراكيبها الحقيقية كما تُنطق فعلاً (لا فصحى مموّهة). يمكن إبقاء السرد بالفصحى إن كان ذلك أنسب للعمل.`;
}

/** كتالوج الأصوات كنص للبرومبت */
export function voiceCatalogText(dialect?: string): string {
  return voicesForDialect(dialect)
    .map((v) => `- ${v.id}: ${v.name} — ${v.gender === "male" ? "ذكر" : "أنثى"}، لهجة ${v.dialect}. ${v.tone}`)
    .join("\n");
}
