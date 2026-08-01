/**
 * مقياس دقة النطق — مقارنة النص الأصلي بتفريغ الناتج الصوتي.
 * التطبيع يُسقط ما لا يُعد خطأ نطق: التشكيل، اختلاف رسم الهمزات
 * والألف والتاء المربوطة، الترقيم والمسافات الزائدة.
 */

/**
 * استبدال كلمة كاملة فقط — لا كجزء من كلمة أخرى: تصحيح «من» إلى «مِنْ»
 * يجب ألا يصيب «منها» أو «زمن». الحدود بالحروف والحركات لا \b اللاتينية
 * (التي لا تفهم العربية)، والبديل يُحصَّن من رموز مجموعات الاستبدال.
 */
export function replaceWholeWord(text: string, word: string, alias: string): string {
  if (!word) return text;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const safeAlias = alias.replace(/\$/g, "$$$$");
  const boundary = new RegExp(`(^|[^\\p{L}\\p{M}])${escaped}(?=$|[^\\p{L}\\p{M}])`, "gmu");
  return text.replace(boundary, `$1${safeAlias}`);
}

/** تطبيع عربي للمقارنة الصوتية العادلة */
export function normalizeArabic(text: string): string {
  return text
    .replace(/[ً-ْٰـ]/g, "") // التشكيل والتطويل
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ") // الترقيم والرموز
    .replace(/\s+/g, " ")
    .trim();
}

/** مسافة Levenshtein بصفّين متدحرجين — تكفي لنصوص التقييم القصيرة */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    prev = curr;
  }
  return prev[b.length];
}

/**
 * دقة النطق 0..1 — واحد ناقص نسبة الخطأ الحرفية (CER) بعد التطبيع.
 * نص فارغ بعد التطبيع → لا حكم (null).
 */
export function pronunciationAccuracy(original: string, transcribed: string): number | null {
  const a = normalizeArabic(original);
  const b = normalizeArabic(transcribed);
  if (!a) return null;
  const cer = levenshtein(a, b) / a.length;
  return Math.max(0, Math.min(1, 1 - cer));
}
