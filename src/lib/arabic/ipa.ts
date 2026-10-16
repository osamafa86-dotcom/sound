/**
 * الكتابة الصوتية الدولية (IPA) للكلمة العربية المشكولة — «النطق المضمون»
 * على محركات الجيل الرابع.
 *
 * الجيل الرابع من ElevenLabs يقرأ الحركات عادةً، لكنه مع الثبات المنخفض
 * ووسوم الأداء يعود لأشهر قراءة للرسم (قيس: «أُحُد» ← «أُحَد» في 3 من 4)،
 * بينما الكلمة نفسها مكتوبةً صوتياً بين شرطتين مائلتين (/ʔuħud/) نُطقت
 * صحيحة في 4 من 4 في أسوأ الإعدادات — والكتابة الصوتية عقد موثّق رسمياً.
 *
 * التحويل حتمي بقواعد الفصحى لا بتخمين نموذج: كل حرف بحركته، والشدة تضعيف،
 * والمدود والتنوين والتاء المربوطة وأل الشمسية والقمرية وهمزة الوصل.
 * الكلمة التي ينقصها تشكيل حرفٍ يُحتاج لحسمه تعيد null — فتبقى عربية كما هي
 * بدل كتابة صوتية مخمَّنة قد تكون أسوأ من الأصل.
 */

const FATHA = "َ";
const DAMMA = "ُ";
const KASRA = "ِ";
const FATHATAN = "ً";
const DAMMATAN = "ٌ";
const KASRATAN = "ٍ";
const SHADDA = "ّ";
const SUKUN = "ْ";
const DAGGER_ALIF = "ٰ";
const QURANIC_SUKUN = "ۡ";

const VOWEL_OF: Record<string, string> = {
  [FATHA]: "a",
  [DAMMA]: "u",
  [KASRA]: "i",
  [FATHATAN]: "an",
  [DAMMATAN]: "un",
  [KASRATAN]: "in",
};

const CONSONANT: Record<string, string> = {
  "ء": "ʔ", "أ": "ʔ", "إ": "ʔ", "ؤ": "ʔ", "ئ": "ʔ",
  "ب": "b", "ت": "t", "ث": "θ", "ج": "dʒ", "ح": "ħ", "خ": "x",
  "د": "d", "ذ": "ð", "ر": "r", "ز": "z", "س": "s", "ش": "ʃ",
  "ص": "sˤ", "ض": "dˤ", "ط": "tˤ", "ظ": "ðˤ", "ع": "ʕ", "غ": "ɣ",
  "ف": "f", "ق": "q", "ك": "k", "ل": "l", "م": "m", "ن": "n",
  "ه": "h", "و": "w", "ي": "j", "ة": "t",
};

/** نطاق التشكيل العربي (الحركات والشدة والسكون والألف الخنجرية) */
const MARK_RE = /[ً-ْٰۡ]/;
const MARKS_RE = /[ً-ْٰۡ]/g;

type Unit = { letter: string; marks: string };

function units(word: string): Unit[] {
  const clean = word
    .normalize("NFC")
    .replace(/ـ/g, "") // التطويل لا يُنطق
    .replace(/أ/g, "أ")
    .replace(/إ/g, "إ")
    .replace(/آ/g, "آ")
    .replace(/ٱ/g, "ا"); // ألف الوصل المرسومة
  const out: Unit[] = [];
  for (const ch of clean) {
    if (MARK_RE.test(ch)) {
      if (!out.length) return [];
      out[out.length - 1].marks += ch;
    } else {
      out.push({ letter: ch, marks: "" });
    }
  }
  return out;
}

function vowelIn(marks: string): string | null {
  for (const m of marks) if (VOWEL_OF[m]) return VOWEL_OF[m];
  return null;
}

const hasSukun = (marks: string) => marks.includes(SUKUN) || marks.includes(QURANIC_SUKUN);

/** هل في الكلمة تشكيل أصلاً؟ */
export function hasDiacritics(text: string): boolean {
  return MARK_RE.test(text);
}

/** الكلمة بلا تشكيل — لمقارنة الرسم */
export function stripDiacritics(text: string): string {
  return text.replace(MARKS_RE, "").replace(/ـ/g, "");
}

/**
 * الكتابة الصوتية للكلمة المشكولة، أو null إن لم تكفِ حركاتها لحسم نطقها
 * أو احتوت ما ليس عربياً.
 */
export function arabicToIpa(word: string): string | null {
  const us = units(word.trim());
  if (!us.length) return null;

  let ipa = "";
  /** آخر حركة قصيرة نُطقت — لمعرفة حروف المد بعدها */
  let lastVowel: string | null = null;

  for (let i = 0; i < us.length; i++) {
    const { letter, marks } = us[i];
    const next = us[i + 1];
    const isLast = i === us.length - 1;
    const vowel = vowelIn(marks);
    const geminate = marks.includes(SHADDA);
    const dagger = marks.includes(DAGGER_ALIF);

    // آ: همزة ومدّ
    if (letter === "آ") {
      ipa += "ʔaː";
      lastVowel = null;
      continue;
    }

    // الألف بلا همزة
    if (letter === "ا") {
      if (vowel) {
        // ألف مشكولة: تنوين فتح على الألف («كتاباً») أو همزة قطع كتبها الكاتب بحركتها («اُحد»)
        if (vowel === "an" && i > 0) ipa += "an";
        else ipa += "ʔ" + vowel;
        lastVowel = vowel.length === 1 ? vowel : null;
      } else if (i === 0) {
        // همزة الوصل في أول الكلمة: تُنطق فتحة في الابتداء (أل) — وأي ألف وصل غيرها لا تُحسم
        if (next?.letter !== "ل") return null;
        ipa += "a";
        lastVowel = "a";
      } else if (isWaslAfterPrefix(us, i)) {
        // ألف «ال» بعد حرف جر أو عطف («وَالْقَمَر»): تسقط وصلاً — قبل فحص المد
        // كي لا تُقرأ «وَالْ» مداً، و«وَالِد» تبقى مداً لأن لامها متحركة
      } else if (lastVowel === "a") {
        ipa = ipa.slice(0, -1) + "aː"; // ألف المد بعد فتحة
        lastVowel = null;
      } else if (us[i - 1]?.marks.includes(FATHATAN)) {
        // ألف تنوين الفتح («كِتَابًا») لا تُنطق
      } else {
        return null;
      }
      continue;
    }

    // الألف المقصورة
    if (letter === "ى") {
      if (vowel === "an") ipa += "an";
      else if (us[i - 1]?.marks.includes(FATHATAN)) {
        // ألف مقصورة بعد تنوين الفتح («هُدًى») لا تُنطق
      }
      else if (lastVowel === "a" || dagger) ipa = (lastVowel === "a" ? ipa.slice(0, -1) : ipa) + "aː";
      else return null;
      lastVowel = null;
      continue;
    }

    // واو المد وياء المد: بلا حركة بعد ضمة أو كسرة
    if ((letter === "و" && !marks && lastVowel === "u") || (letter === "ي" && !marks && lastVowel === "i")) {
      ipa = ipa.slice(0, -1) + (letter === "و" ? "uː" : "iː");
      lastVowel = null;
      continue;
    }

    // التاء المربوطة الساكنة وقفاً: الفتحة قبلها كافية
    if (letter === "ة" && !vowel) {
      if (lastVowel !== "a") return null;
      lastVowel = null;
      continue;
    }

    const consonant = CONSONANT[letter];
    if (!consonant) return null;

    // لام «ال» الشمسية: تُدغم في الحرف المشدّد بعدها فلا تُنطق
    if (letter === "ل" && !marks && next?.marks.includes(SHADDA) && isArticleLam(us, i)) {
      continue;
    }

    // الإدغام: الحرف المشدد يُضعَّف بأول رموزه («مّ» mm، «جّ» ddʒ، «صّ» ssˤ)
    ipa += geminate ? consonant[0] + consonant : consonant;

    if (dagger) {
      ipa += "aː";
      lastVowel = null;
    } else if (vowel) {
      ipa += vowel;
      lastVowel = vowel.length === 1 ? vowel : null;
    } else if (hasSukun(marks) || isLast) {
      lastVowel = null; // ساكن، أو آخر الكلمة موقوفاً عليه
    } else if (letter === "ل" && isArticleLam(us, i)) {
      lastVowel = null; // لام «ال» القمرية تُكتب بلا سكون عادةً
    } else if (letter === "إ") {
      ipa += "i"; // الهمزة تحت الألف كسرتها مفهومة
      lastVowel = "i";
    } else if (next?.letter === "ا" && next.marks.includes(FATHATAN)) {
      lastVowel = null; // تنوين الفتح مرسوم على الألف بعده («كِتَاباً»)
    } else {
      return null; // حرف بلا حركة في وسط الكلمة: لا يُحسم نطقه
    }
  }

  return ipa || null;
}

/** لام التعريف: بعد ألف الوصل («ال») أو بعد لام الجر («لِلْ») */
function isArticleLam(us: Unit[], i: number): boolean {
  const prev = us[i - 1];
  if (!prev) return false;
  if (prev.letter === "ا" && !vowelIn(prev.marks)) return true;
  return prev.letter === "ل" && i === 1 && vowelIn(prev.marks) === "i";
}

/** ألف «ال» بعد حروف السوابق المشكولة: وَ فَ بِ كَ */
function isWaslAfterPrefix(us: Unit[], i: number): boolean {
  const lam = us[i + 1];
  // لام التعريف ساكنة أو بلا حركة؛ اللام المتحركة («وَالِد») تجعل الألف مداً
  if (i === 0 || lam?.letter !== "ل" || vowelIn(lam.marks)) return false;
  return us.slice(0, i).every((u) => "وفبك".includes(u.letter) && vowelIn(u.marks));
}

/**
 * حدود الكلمة: ما قبلها وما بعدها ليس حرفاً عربياً أو حركة أو حرفاً لاتينياً.
 * الحروف والحركات وحدها (لا كامل نطاق U+0600) كي تبقى الفاصلة «،» والفاصلة
 * المنقوطة «؛» وعلامة الاستفهام «؟» حدوداً لا جزءاً من الكلمة.
 */
const WORD_CHAR = "\\u0621-\\u065F\\u0670-\\u06D3\\u06E1a-zA-Z";
function wholeWord(word: string): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![${WORD_CHAR}])${escaped}(?![${WORD_CHAR}])`, "g");
}

/**
 * يستبدل بكل كلمة حساسة في النص كتابتها الصوتية بين شرطتين مائلتين —
 * الصيغة الموثقة للجيل الرابع. الكلمة التي لا تُحسم تبقى عربية.
 */
export function applyIpa(text: string, words: readonly string[]): string {
  const unique = [...new Set(words.map((w) => w.trim()).filter((w) => w && hasDiacritics(w)))];
  // الأطول أولاً كي لا تُستبدل كلمة داخل عبارة أطول منها
  unique.sort((a, b) => b.length - a.length);
  let out = text;
  for (const word of unique) {
    const ipa = arabicToIpa(word);
    if (ipa) out = out.replace(wholeWord(word), `/${ipa}/`);
  }
  return out;
}

/** الكلمات التي تُفرض فعلاً: ما تحسمه حركاته وحده (غيرها يبقى عربياً) */
export function enforceableWords(words: readonly string[]): string[] {
  return [...new Set(words)].filter((w) => arabicToIpa(w) !== null);
}

/**
 * تقطيع النص كلماتٍ عربية وما بينها كما هو — لمعاينة المحرر التي تُبرز
 * الكلمات المفروضة وتجعل كل كلمة مشكولة قابلة للنقر.
 */
export function tokenizeArabic(text: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = [];
  const re = new RegExp(`[${WORD_CHAR}]+`, "g");
  let last = 0;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), word: false });
    out.push({ text: m[0], word: true });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}

/** ترويسة الكلمات المفروضة في استجابة الصوت (ASCII آمن) — وقراءتها في المتصفح */
export const CRITICAL_HEADER = "X-Critical-Words";
export function encodeCriticalHeader(words: readonly string[]): string {
  return encodeURIComponent(JSON.stringify(words));
}
export function decodeCriticalHeader(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed) ? parsed.filter((w): w is string => typeof w === "string") : [];
  } catch {
    return [];
  }
}
