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
 * محاذاة كلمات التفريغ مع النص المكتوب المشكّل — التفريغ يعيد الكلمات عارية
 * من الحركات، فنستبدل بكل كلمة مطابقة صورتَها المكتوبة بتشكيلها الكامل
 * (مع إبقاء توقيتها)، فيعرض المحرر النص كما كُتب وغُنّي لا كما فُرّغ.
 * كلمات الترويسات («لازمة:») والكلمات غير المطابقة تُتخطى بنافذة قصيرة.
 */
export function alignWordsToLyrics(words: KaraokeWord[], written: string): KaraokeWord[] {
  const tokens = written.split(/\s+/).filter(Boolean);
  if (!tokens.length) return words;
  const norms = tokens.map(normalizeWord);

  let cursor = 0;
  const WINDOW = 4;
  return words.map((w) => {
    const wn = normalizeWord(w.text);
    if (!wn) return w;
    for (let j = cursor; j < Math.min(cursor + WINDOW, tokens.length); j++) {
      if (norms[j] && norms[j] === wn) {
        cursor = j + 1;
        const display = tokens[j].replace(EDGE_PUNCT, "");
        return { ...w, ...(display && { text: display }), matched: true };
      }
    }
    // لا مقابل في النص المكتوب: غُنّيت مختلفة (انحراف محرك أو خطأ تفريغ)
    return { ...w, matched: false };
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
  const wordNorms = words.map((w) => normalizeWord(w.text));

  const starts: (number | null)[] = sections.map(() => null);
  let cursor = 0;
  let anyMatched = false;

  for (let i = 0; i < sections.length; i++) {
    const sectionWords = sections[i].lyrics
      .split(/\s+/)
      .map(normalizeWord)
      .filter(Boolean);
    if (!sectionWords.length) continue; // آلي (مقدمة/خاتمة) — يُقدَّر لاحقاً

    let firstMatch = -1;
    let matched = 0;
    let c = cursor;
    for (const sw of sectionWords) {
      for (let j = c; j < Math.min(c + 6, words.length); j++) {
        if (wordNorms[j] && wordNorms[j] === sw) {
          if (firstMatch < 0) firstMatch = j;
          matched++;
          c = j + 1;
          break;
        }
      }
    }
    if (firstMatch >= 0 && matched / sectionWords.length >= 0.5) {
      starts[i] = words[firstMatch].start;
      cursor = c;
      anyMatched = true;
    }
  }
  if (!anyMatched) return null;

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
  const header = title ? `[ti:${title}]\n[by:منصة مقام]\n` : "";
  return (
    header +
    groupWords(words)
      .map((line) => `[${lrcTime(line.start)}]${line.text}`)
      .join("\n")
  );
}
