/**
 * الكاريوكي — مزامنة الكلمات مع التشغيل وتصدير ملفات الترجمة.
 * الطوابع الزمنية بالثواني كما يعيدها محرك التفريغ (Scribe).
 */

export type KaraokeWord = {
  text: string;
  start: number;
  end: number;
  /** بعد المحاذاة: هل طابقت كلمةَ النص المكتوب؟ false = غُنّيت مختلفة عنه */
  matched?: boolean;
  /**
   * للمنحرفة (matched: false): الكلمة المكتوبة المرجحة في موضعها —
   * بها يُملأ حقل التصحيح كي يصيب الاستبدال نصَّ المستخدم لا صورةَ السماع
   */
  suggestedWritten?: string;
};

export type KaraokeLine = { start: number; end: number; text: string };

const ARABIC_MARKS = /[ً-ْٰـ]/g;
const EDGE_PUNCT = /^[^\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+$/gu;

/** توحيد كلمة للمقارنة: بلا حركات ولا ترقيم، وتطبيع الهمزات والتاء المربوطة */
function normalizeWord(w: string): string {
  return w
    .replace(ARABIC_MARKS, "")
    .replace(EDGE_PUNCT, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة$/, "ه");
}

/**
 * الطيّ الصوتي فوق التوحيد: أزواج حروف يتطابق سماعها في الغناء العربي
 * فيكتبها التفريغ بأيٍّ من صورتيها (وصمودك ⟵ وسمودك، طُهر ⟵ تهر) —
 * إملاء مختلف لصوت واحد لا انحراف نطق، فلا يجوز أن يُخصم من نسبة المطابقة.
 * المعنى لا يتأثر: المقارنة بالمفتاح المطويّ والعرضُ بالنص المكتوب الأصلي.
 */
function phoneticKey(w: string): string {
  return normalizeWord(w)
    .replace(/[صث]/g, "س")
    .replace(/ض/g, "د")
    .replace(/ط/g, "ت")
    .replace(/[ظذ]/g, "ز")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ء$/, "");
}

/**
 * أطول تسلسل مشترك بين قائمتي كلمات موحّدة — محاذاة عالمية مثلى:
 * تستوعب الحذف والإضافة والتكرار وتستعيد التزامن بعد أي انحراف،
 * بعكس المحاذاة الجشعة بنافذة قصيرة التي تنهار عند أول اختلاف.
 * أزواج (فهرس أ، فهرس ب) بترتيب تصاعدي، وكسر التعادل يقدّم القائمة
 * الأولى فيقترن التكرار المغنّى بأول ظهور مكتوب (يخدم بدايات المقاطع).
 */
function lcsPairs(a: string[], b: string[]): [number, number][] {
  const n = a.length;
  const m = b.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] && a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: [number, number][] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return pairs;
}

/**
 * محاذاة كلمات التفريغ مع النص المكتوب المشكّل — التفريغ يعيد الكلمات عارية
 * من الحركات، فنستبدل بكل كلمة مطابقة صورتَها المكتوبة بتشكيلها الكامل
 * (مع إبقاء توقيتها)، ونعلّم غير المطابقة (matched: false) كاشفاً للانحراف.
 * المحاذاة بأطول تسلسل مشترك — تصمد أمام الحشو والتكرار وحذف الكلمات.
 */
export function alignWordsToLyrics(words: KaraokeWord[], written: string): KaraokeWord[] {
  const tokens = written.split(/\s+/).filter(Boolean);
  if (!tokens.length) return words;
  const tokenNorms = tokens.map(phoneticKey);
  const wordNorms = words.map((w) => phoneticKey(w.text));

  const pairs = lcsPairs(wordNorms, tokenNorms);
  const pairing = new Map<number, number>(pairs);
  const display = new Map<number, string>();
  for (const [i, j] of pairs) display.set(i, tokens[j].replace(EDGE_PUNCT, ""));

  // الالتحام الإملائي اللهجي: «عالبلاد» المغناة = «عَ» + «الْبَلَادْ» المكتوبتان
  // والعكس «قُولْلهَا» المكتوبة = «قول» + «لها» المغناتين — مطابقة صوتياً
  // حرفاً بحرف رغم اختلاف التقطيع، فتُقترن في فجوات ما لم يقترنه LCS
  const pairedTokens = new Set(pairs.map(([, j]) => j));
  const suggestions = new Map<number, string>();
  let cursor = 0; // أول رمز مكتوب غير مقترن لم نتجاوزه بعد
  for (let i = 0; i < words.length; i++) {
    const bound = pairing.get(i);
    if (bound !== undefined) {
      cursor = Math.max(cursor, bound + 1);
      continue;
    }
    if (!wordNorms[i]) continue;
    while (cursor < tokens.length && pairedTokens.has(cursor)) cursor++;
    if (cursor >= tokens.length) break;

    // كلمة مغناة واحدة ⟵ رمزان مكتوبان متتاليان ملتحمان
    if (
      cursor + 1 < tokens.length &&
      !pairedTokens.has(cursor + 1) &&
      wordNorms[i] === tokenNorms[cursor] + tokenNorms[cursor + 1]
    ) {
      pairing.set(i, cursor);
      display.set(
        i,
        `${tokens[cursor].replace(EDGE_PUNCT, "")} ${tokens[cursor + 1].replace(EDGE_PUNCT, "")}`.trim()
      );
      pairedTokens.add(cursor);
      pairedTokens.add(cursor + 1);
      continue;
    }
    // كلمتان مغناتان ⟵ رمز مكتوب واحد ملتحم
    if (
      i + 1 < words.length &&
      !pairing.has(i + 1) &&
      wordNorms[i] + wordNorms[i + 1] === tokenNorms[cursor]
    ) {
      pairing.set(i, cursor);
      pairing.set(i + 1, cursor);
      pairedTokens.add(cursor);
      i++; // الثانية اقترنت أيضاً — نصّاهما يبقيان كما سُمعا
      continue;
    }
    // انحراف حقيقي: الرمز المكتوب غير المقترن في موضعها هو مقابلها المرجح —
    // به يُملأ حقل التصحيح فيصيب الاستبدالُ نصَّ المستخدم لا صورةَ السماع
    suggestions.set(i, tokens[cursor].replace(EDGE_PUNCT, ""));
  }

  return words.map((w, i) => {
    if (!wordNorms[i]) return w;
    if (!pairing.has(i)) {
      // لا مقابل في النص المكتوب: غُنّيت مختلفة (انحراف محرك أو خطأ تفريغ)
      const s = suggestions.get(i);
      return { ...w, matched: false, ...(s && { suggestedWritten: s }) };
    }
    const d = display.get(i);
    return { ...w, ...(d && { text: d }), matched: true };
  });
}

import type { SongSection } from "./songSections";

/**
 * حدود المقاطع الفعلية من التفريغ الموقوت — الزمن المخطط يكذب:
 * المحركات (Lyria خاصة) لا تلتزم بمدد المقاطع، فبدل جمع durationSec تراكمياً
 * نطابق كلمات كل مقطع مع كلمات التفريغ ونستخرج لحظة بدايته الحقيقية.
 * مقطع لم يُطابَق (آلي أو غناء حر) يُقدَّر من جاره + مدته المخططة.
 * الناتج مصفوفة بدايات رتيبة بطول المقاطع، أو null عند تعذر أي مطابقة.
 */
export function measureSectionStarts(
  words: KaraokeWord[],
  sections: SongSection[]
): number[] | null {
  if (!words.length || !sections.length) return null;
  const wordNorms = words.map((w) => phoneticKey(w.text));

  // كلمات كل المقاطع في قائمة واحدة مع نسب كل كلمة لمقطعها
  const tokenNorms: string[] = [];
  const tokenSection: number[] = [];
  const sectionTokenCount = sections.map(() => 0);
  sections.forEach((s, si) => {
    for (const t of s.lyrics.split(/\s+/).map(phoneticKey).filter(Boolean)) {
      tokenNorms.push(t);
      tokenSection.push(si);
      sectionTokenCount[si]++;
    }
  });
  if (!tokenNorms.length) return null;

  // محاذاة مثلى واحدة ثم إسناد أول اقتران لكل مقطع بدايةً له
  const firstHit: (number | null)[] = sections.map(() => null);
  const hitCount = sections.map(() => 0);
  for (const [wi, tj] of lcsPairs(wordNorms, tokenNorms)) {
    const si = tokenSection[tj];
    hitCount[si]++;
    if (firstHit[si] === null) firstHit[si] = wi;
  }

  const starts: (number | null)[] = sections.map((_, si) =>
    firstHit[si] !== null && hitCount[si] / sectionTokenCount[si] >= 0.4
      ? words[firstHit[si]!].start
      : null
  );
  if (!starts.some((s) => s !== null)) return null;

  // تقدير غير المُطابَق: بداية الجار السابق + مدته المخططة، بلا تجاوز التالي المعلوم
  const resolved: number[] = [];
  for (let i = 0; i < sections.length; i++) {
    let s = starts[i];
    if (s === null) {
      s = i === 0 ? 0 : resolved[i - 1] + sections[i - 1].durationSec;
      const nextKnown = starts.slice(i + 1).find((v) => v !== null);
      if (nextKnown !== null && nextKnown !== undefined) s = Math.min(s, nextKnown);
    }
    resolved.push(i === 0 ? Math.max(0, s) : Math.max(resolved[i - 1], s));
  }
  return resolved;
}

/** نسبة مطابقة الغناء للنص المكتوب من أعلام المحاذاة — null قبل المحاذاة */
export function adherencePercent(words: KaraokeWord[]): number | null {
  const judged = words.filter((w) => w.matched !== undefined);
  if (!judged.length) return null;
  return Math.round((judged.filter((w) => w.matched).length / judged.length) * 100);
}

/** فهرس المقطع للحظة تشغيل حسب البدايات المقيسة — آخر بداية لا تتجاوزها */
export function sectionIndexFromStarts(starts: number[], sec: number): number {
  let idx = 0;
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= sec) idx = i;
    else break;
  }
  return idx;
}

/** آخر كلمة بدأت قبل اللحظة الحالية — أو -1 قبل أول كلمة */
export function findActiveWord(words: KaraokeWord[], sec: number): number {
  let active = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i].start <= sec) active = i;
    else break;
  }
  return active;
}

/** تجميع الكلمات أسطراً: فجوة صمت > ٠.٧ ثانية أو ٨ كلمات تفتح سطراً جديداً */
export function groupWords(words: KaraokeWord[]): KaraokeLine[] {
  const lines: KaraokeLine[] = [];
  let current: KaraokeWord[] = [];

  const flush = () => {
    if (!current.length) return;
    lines.push({
      start: current[0].start,
      end: current[current.length - 1].end,
      text: current.map((w) => w.text).join(" "),
    });
    current = [];
  };

  for (const w of words) {
    const last = current[current.length - 1];
    if (last && (w.start - last.end > 0.7 || current.length >= 8)) flush();
    current.push(w);
  }
  flush();
  return lines;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

function srtTime(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms % 1000, 3)}`;
}

function lrcTime(sec: number): string {
  const cs = Math.max(0, Math.round(sec * 100));
  return `${pad(Math.floor(cs / 6000))}:${pad(Math.floor((cs % 6000) / 100))}.${pad(cs % 100)}`;
}

/** ملف ترجمة SRT — للمونتاج والريلز */
export function buildSrt(words: KaraokeWord[]): string {
  return groupWords(words)
    .map((line, i) => `${i + 1}\n${srtTime(line.start)} --> ${srtTime(line.end)}\n${line.text}\n`)
    .join("\n");
}

/** ملف كلمات LRC — لمشغلات الموسيقى */
export function buildLrc(words: KaraokeWord[], title?: string): string {
  const header = title ? `[ti:${title}]\n[by:منصة لحّن]\n` : "";
  return (
    header +
    groupWords(words)
      .map((line) => `[${lrcTime(line.start)}]${line.text}`)
      .join("\n")
  );
}
