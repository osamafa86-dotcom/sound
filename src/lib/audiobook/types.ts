/**
 * استوديو الكتب الصوتية — من نصّ طويل إلى كتاب مسموع مقسّم إلى فصول.
 *
 * الفرق عن استوديو النص إلى صوت ليس في محرك النطق بل في الطبقة فوقه:
 * اكتشاف بنية الكتاب (فصوله وعناوينه)، وتقدير مدته، وإنتاج كل فصل كملف
 * مستقل يمكن مراجعته وإعادة إنتاجه وحده — كما تُنتج الكتب الصوتية فعلاً.
 */

export type BookChapter = {
  /** معرّف ثابت داخل الكتاب — ch-1، ch-2... */
  id: string;
  title: string;
  text: string;
  chars: number;
  /** مدة تقديرية بالثواني قبل الإنتاج */
  estimatedSec: number;
};

export type BookOutline = {
  title: string;
  chapters: BookChapter[];
  totalChars: number;
  estimatedSec: number;
  /** true عندما يتجاوز النص الأصلي الحد المسموح فيُقتطع آخره */
  truncated: boolean;
};

export const AUDIOBOOK_LIMITS = {
  /** أقصى نص للكتاب الواحد — نحو ٢٤ ألف كلمة عربية */
  maxInputChars: 120_000,
  /** أقصى عدد فصول تُعرض؛ ما زاد يُدمج مع جيرانه بلا فقد نص */
  maxChapters: 80,
  /** أقصى طول للفصل الواحد — ما زاد يُقسَّم إلى أجزاء مرقّمة */
  maxChapterChars: 12_000,
  /** الطول المستهدف للمقطع عند غياب عناوين صريحة في النص */
  targetChapterChars: 4_000,
  /** سرعة القراءة التقديرية للعربية: حرفاً في الثانية بسرعة طبيعية */
  charsPerSecond: 14,
} as const;
