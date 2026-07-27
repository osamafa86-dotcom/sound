/**
 * الكاريوكي — مزامنة الكلمات مع التشغيل وتصدير ملفات الترجمة.
 * الطوابع الزمنية بالثواني كما يعيدها محرك التفريغ (Scribe).
 */

export type KaraokeWord = { text: string; start: number; end: number };

export type KaraokeLine = { start: number; end: number; text: string };

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
