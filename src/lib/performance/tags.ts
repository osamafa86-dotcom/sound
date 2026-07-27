/**
 * وسوم الأداء داخل النص — لغة «المخرج الصوتي»:
 * أزرار عربية تُدرج وسوماً إنجليزية بين قوسين يفهمها الجيل الثالث
 * من المحرك وسط النص العربي، فتتحكم باللحظة لا بالنص كله.
 */

export type AudioTag = { id: string; name: string; tag: string };

export const TAG_GROUPS: { id: string; name: string; icon: string; tags: AudioTag[] }[] = [
  {
    id: "pauses",
    name: "توقفات",
    icon: "⏱",
    tags: [
      { id: "pause", name: "وقفة", tag: "[pause]" },
      { id: "long-pause", name: "وقفة طويلة", tag: "[long pause]" },
      { id: "beat", name: "لحظة صمت درامي", tag: "[dramatic pause]" },
    ],
  },
  {
    id: "emotions",
    name: "مشاعر",
    icon: "🎭",
    tags: [
      { id: "sad", name: "حزين", tag: "[sad]" },
      { id: "excited", name: "متحمس", tag: "[excited]" },
      { id: "whisper", name: "همس", tag: "[whispering]" },
      { id: "angry", name: "غاضب", tag: "[angry]" },
      { id: "happy", name: "مبتهج", tag: "[happily]" },
      { id: "curious", name: "فضولي", tag: "[curious]" },
      { id: "sarcastic", name: "ساخر", tag: "[sarcastic]" },
      { id: "calm", name: "هادئ", tag: "[calmly]" },
    ],
  },
  {
    id: "actions",
    name: "أفعال",
    icon: "🫁",
    tags: [
      { id: "laughs", name: "ضحكة", tag: "[laughs]" },
      { id: "sighs", name: "تنهيدة", tag: "[sighs]" },
      { id: "breath", name: "نفَس عميق", tag: "[exhales deeply]" },
      { id: "gasp", name: "شهقة", tag: "[gasps]" },
      { id: "clears", name: "تنحنح", tag: "[clears throat]" },
    ],
  },
];

/** إدراج وسم عند موضع المؤشر مع مسافات سليمة — نقية وقابلة للاختبار */
export function insertTagAt(text: string, cursor: number, tag: string): { text: string; cursor: number } {
  const at = Math.min(Math.max(0, cursor), text.length);
  const before = text.slice(0, at);
  const after = text.slice(at);
  const needSpaceBefore = before.length > 0 && !/\s$/.test(before);
  const needSpaceAfter = after.length > 0 && !/^\s/.test(after);
  const inserted = `${needSpaceBefore ? " " : ""}${tag}${needSpaceAfter ? " " : ""}`;
  return { text: before + inserted + after, cursor: at + inserted.length };
}

/** هل يحتوي النص وسوم أداء؟ — لتفعيل المحرك التعبيري تلقائياً */
export function hasAudioTags(text: string): boolean {
  return /\[[a-zA-Z][^\]؀-ۿ]{1,40}\]/.test(text);
}

/**
 * دلالات منطوقة — نص عربي يُدرج كما هو فيؤديه المحرك صوتاً:
 * ضحك وتنهد وتردد تُكتب في النص نفسه لا كوسوم إنجليزية.
 */
export const SPOKEN_CUES: { id: string; name: string; cue: string }[] = [
  { id: "haha", name: "هاهاها", cue: "هاهاها" },
  { id: "aah", name: "آآه", cue: "آآه..." },
  { id: "ooff", name: "أوووف", cue: "أوووف..." },
  { id: "hmm", name: "همم", cue: "هممم..." },
  { id: "dramatic-dots", name: "وقفة درامية ...", cue: "..." },
];

/**
 * التلعثم المتعمد — حيلة الخوف والارتباك:
 * يحوّل الكلمة المحددة (أو التي عند المؤشر) إلى «أـ أـ أنا».
 * نقية وقابلة للاختبار؛ تعيد النص كما هو إن لم توجد كلمة.
 */
export function stutterize(
  text: string,
  start: number,
  end: number
): { text: string; cursor: number } {
  let from = Math.min(Math.max(0, start), text.length);
  let to = Math.min(Math.max(from, end), text.length);

  // بلا تحديد: نتوسع لحدود الكلمة المحيطة بالمؤشر
  if (from === to) {
    while (from > 0 && !/\s/.test(text[from - 1])) from--;
    while (to < text.length && !/\s/.test(text[to])) to++;
  }

  const selected = text.slice(from, to);
  const wordMatch = selected.match(/[؀-ۿ]+/);
  if (!wordMatch || wordMatch.index === undefined) return { text, cursor: end };

  const word = wordMatch[0];
  const wordStart = from + wordMatch.index;
  // الحرف الأول مع همزته/مدّته إن وجدت — «أنا» تتلعثم بـ«أـ» لا بجزء مبتور
  const first = word[0];
  const stuttered = `${first}ـ ${first}ـ ${word}`;

  const nextText = text.slice(0, wordStart) + stuttered + text.slice(wordStart + word.length);
  return { text: nextText, cursor: wordStart + stuttered.length };
}
