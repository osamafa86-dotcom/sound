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
