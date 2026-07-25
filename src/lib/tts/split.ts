/**
 * تقسيم النصوص الطويلة لمقاطع تناسب حدود محركات TTS، عند حدود الجمل
 * ما أمكن كي لا تنقطع القراءة وسط جملة — أساس دعم الكتب الصوتية.
 */

const SENTENCE_BOUNDARY = /[.!؟?؛\n]/;

export function splitTextForTTS(text: string, maxLen = 2800): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed ? [trimmed] : [];

  const chunks: string[] = [];
  let rest = trimmed;

  while (rest.length > maxLen) {
    // ابحث عن آخر حد جملة ضمن النافذة؛ وإلا آخر مسافة؛ وإلا اقطع بالقوة
    const window = rest.slice(0, maxLen);
    let cut = -1;
    for (let i = window.length - 1; i >= 0; i--) {
      if (SENTENCE_BOUNDARY.test(window[i])) {
        cut = i + 1;
        break;
      }
    }
    if (cut < maxLen * 0.3) {
      const space = window.lastIndexOf(" ");
      cut = space > maxLen * 0.3 ? space + 1 : maxLen;
    }
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}
