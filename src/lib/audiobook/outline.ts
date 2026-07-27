import { splitTextForTTS } from "@/lib/tts/split";
import { AUDIOBOOK_LIMITS, type BookChapter, type BookOutline } from "./types";

/**
 * اكتشاف بنية الكتاب — دوال خالصة بلا شبكة ولا ذكاء اصطناعي.
 *
 * تقسيم الكتاب قرار بنيوي لا إبداعي: عناوين الفصول موجودة في النص أصلاً،
 * فاستخراجها بقواعد واضحة أسرع وأرخص وأدقّ من سؤال نموذج لغوي عنها —
 * ويعمل بلا أي مفتاح API.
 */

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** أرقام هندية عربية — الواجهة كلها عربية فتُكتب الأرقام بصيغتها */
export function toArabicDigits(n: number): string {
  return String(n).replace(/[0-9]/g, (d) => AR_DIGITS[Number(d)]);
}

/** عنوان Markdown: ‎# عنوان‎ حتى ست درجات */
const MD_HEADING = /^\s{0,3}#{1,6}\s+(.{1,80}?)\s*#*\s*$/;
/** فاصل بصري بين الفصول: ‎---‎ أو ‎***‎ */
const SEPARATOR = /^\s*(?:[*\-_=–—]\s*){3,}$/;
/** «الفصل الأول»، «الباب الثاني»، «المشهد الثالث»... */
const CHAPTER_MARKER = /^(?:الفصل|الباب|القسم|الجزء|المشهد|فصل|باب|مشهد)(?:\s[^\n]{0,60})?$/;
/** أقسام الكتاب المعروفة بأسمائها المجرّدة */
const NAMED_SECTION =
  /^(?:ال)?(?:مقدمة|مقدّمة|تمهيد|توطئة|خاتمة|إهداء|اهداء|ملخص|خلاصة|مراجع|فهرس|شكر وتقدير)$/;
/** سطر معنون برقم: «١- العنوان» أو «3. العنوان» */
const NUMBERED = /^[0-9٠-٩]{1,3}\s*[-–—.):]\s*\S[^\n]{0,60}$/;

/**
 * هل هذا السطر عنوان فصل؟ يعيد العنوان، أو سلسلة فارغة لفاصل بلا عنوان،
 * أو null إن لم يكن عنواناً.
 *
 * العناوين غير المعلَّمة بـ Markdown تُشترط لها العزلة (سطر فارغ قبلها) كي لا
 * يُقرأ سطرٌ داخل فقرة عنواناً؛ والسطور المرقّمة تُشترط لها العزلة من الجهتين
 * لأن قوائم التعداد داخل الكتاب تشبهها.
 */
export function headingOf(line: string, prevBlank: boolean, nextBlank: boolean): string | null {
  const md = line.match(MD_HEADING);
  if (md) return md[1].trim();
  if (SEPARATOR.test(line)) return "";

  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80 || !prevBlank) return null;

  const bare = trimmed.replace(/[:：]+$/, "").trim();
  if (CHAPTER_MARKER.test(bare) || NAMED_SECTION.test(bare)) return bare;
  if (nextBlank && NUMBERED.test(bare)) return bare;
  return null;
}

export type DetectedChapter = {
  title: string;
  text: string;
  /** true للكتلة التي تسبق أول عنوان — عنوانها من عندنا لا من الكتاب */
  implicit?: boolean;
};

/** يقسّم النص عند عناوينه المكتشفة — بلا فقد حرف واحد من المتن */
export function detectChapters(text: string): DetectedChapter[] {
  const lines = normalize(text).split("\n");
  const blank = (i: number) => i < 0 || i >= lines.length || !lines[i].trim();

  const found: { title: string; body: string[]; implicit?: boolean }[] = [];
  let current: { title: string; body: string[]; implicit?: boolean } | null = null;
  let autoIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const heading = headingOf(lines[i], blank(i - 1), blank(i + 1));
    if (heading !== null) {
      if (current) found.push(current);
      autoIndex++;
      current = { title: heading || `المقطع ${toArabicDigits(autoIndex)}`, body: [] };
      continue;
    }
    if (!current) current = { title: "المقدمة", body: [], implicit: true };
    current.body.push(lines[i]);
  }
  if (current) found.push(current);

  return found
    .map((c) => ({ title: c.title, text: c.body.join("\n").trim(), implicit: c.implicit }))
    .filter((c) => c.text.length > 0);
}

/** مدة تقديرية بالثواني لعدد حروف عند سرعة قراءة معينة */
export function estimateSeconds(chars: number, speed = 1): number {
  const rate = AUDIOBOOK_LIMITS.charsPerSecond * (speed > 0 ? speed : 1);
  return Math.round(chars / rate);
}

/** مدة مقروءة بالعربية: «٥٤ دقيقة» أو «ساعة و١٢ دقيقة» */
export function formatDuration(sec: number): string {
  const total = Math.max(0, Math.round(sec));
  if (total < 60) return `${toArabicDigits(total)} ثانية`;

  const minutes = Math.round(total / 60);
  if (minutes < 60) return `${toArabicDigits(minutes)} دقيقة`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursText = hours === 1 ? "ساعة" : hours === 2 ? "ساعتان" : `${toArabicDigits(hours)} ساعات`;
  return rest ? `${hoursText} و${toArabicDigits(rest)} دقيقة` : hoursText;
}

/** يبني فهرس الكتاب كاملاً من نصّ خام */
export function buildOutline(rawText: string, rawTitle?: string): BookOutline {
  const full = normalize(rawText).trim();
  const truncated = full.length > AUDIOBOOK_LIMITS.maxInputChars;
  const text = truncated ? full.slice(0, AUDIOBOOK_LIMITS.maxInputChars) : full;

  const title = bookTitle(text, rawTitle);
  const detected = detectChapters(text);
  let chapters: { title: string; text: string }[] = detected;

  // نصّ بلا أي عنوان: تقسيم متوازن عند حدود الفقرات بدل كتلة واحدة ضخمة
  const untitled = detected.length === 0 || (detected.length === 1 && !!detected[0].implicit);
  if (untitled) {
    const body = chapters[0]?.text ?? text;
    const parts =
      body.length > AUDIOBOOK_LIMITS.targetChapterChars * 1.5
        ? splitByParagraph(body, AUDIOBOOK_LIMITS.targetChapterChars)
        : body
          ? [body]
          : [];
    chapters = parts.map((part, i) => ({
      title: parts.length > 1 ? `المقطع ${toArabicDigits(i + 1)}` : title,
      text: part,
    }));
  }

  chapters = mergeToFit(chapters, AUDIOBOOK_LIMITS.maxChapters);
  chapters = splitLongChapters(chapters, AUDIOBOOK_LIMITS.maxChapterChars);

  const withStats: BookChapter[] = chapters.map((c, i) => ({
    id: `ch-${i + 1}`,
    title: (c.title || `المقطع ${toArabicDigits(i + 1)}`).slice(0, 120),
    text: c.text,
    chars: c.text.length,
    estimatedSec: estimateSeconds(c.text.length),
  }));

  const totalChars = withStats.reduce((sum, c) => sum + c.chars, 0);
  return {
    title,
    chapters: withStats,
    totalChars,
    estimatedSec: estimateSeconds(totalChars),
    truncated,
  };
}

/** عنوان الكتاب: ما كتبه المستخدم، وإلا أول عنوان في النص، وإلا اسم عام */
function bookTitle(text: string, provided?: string): string {
  const given = provided?.trim();
  if (given) return given.slice(0, 120);

  for (const line of text.split("\n")) {
    const md = line.match(MD_HEADING);
    if (md) return md[1].trim().slice(0, 120);
    if (line.trim()) {
      const first = line.trim();
      return first.length <= 80 ? first.slice(0, 120) : "كتاب صوتي";
    }
  }
  return "كتاب صوتي";
}

/** الفصول الطويلة تُقسَّم إلى أجزاء مرقّمة تحمل عنوان الفصل نفسه */
function splitLongChapters(
  chapters: { title: string; text: string }[],
  maxChars: number
): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = [];
  for (const chapter of chapters) {
    if (chapter.text.length <= maxChars) {
      out.push(chapter);
      continue;
    }
    const parts = splitByParagraph(chapter.text, maxChars);
    parts.forEach((part, i) =>
      out.push({
        title: `${chapter.title} (${toArabicDigits(i + 1)}/${toArabicDigits(parts.length)})`,
        text: part,
      })
    );
  }
  return out;
}

/**
 * دمج الفصول الزائدة عن الحد: يُضمّ في كل دورة أقصر جارين، فيبقى النص كاملاً
 * (عنوان الفصل المدموج يبقى داخل المتن ليُقرأ في مكانه).
 */
function mergeToFit(
  chapters: { title: string; text: string }[],
  max: number
): { title: string; text: string }[] {
  const list = [...chapters];
  while (list.length > max) {
    let bestIndex = 0;
    let bestLength = Infinity;
    for (let i = 0; i < list.length - 1; i++) {
      const combined = list[i].text.length + list[i + 1].text.length;
      if (combined < bestLength) {
        bestLength = combined;
        bestIndex = i;
      }
    }
    const [a, b] = [list[bestIndex], list[bestIndex + 1]];
    list.splice(bestIndex, 2, { title: a.title, text: `${a.text}\n\n${b.title}\n\n${b.text}`.trim() });
  }
  return list;
}

/** تجميع الفقرات في مقاطع لا تتجاوز الحد، والفقرة الأطول من الحد تُقسَّم عند حدود الجمل */
function splitByParagraph(text: string, max: number): string[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .flatMap((p) => (p.length > max ? splitTextForTTS(p, max) : [p]));

  const out: string[] = [];
  let buffer = "";
  for (const paragraph of paragraphs) {
    const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
    if (candidate.length > max && buffer) {
      out.push(buffer);
      buffer = paragraph;
    } else {
      buffer = candidate;
    }
  }
  if (buffer.trim()) out.push(buffer.trim());
  return out;
}

function normalize(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}
