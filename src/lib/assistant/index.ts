import { claudeAssistant } from "./claude";
import { geminiAssistant } from "./gemini";
import { mockAssistant } from "./mock";
import type { LyricsAssistant } from "./types";

/**
 * مساعدو الكلمات المتاحون حسب المفاتيح، بترتيب الأولوية:
 * Claude (ANTHROPIC_API_KEY) ثم Gemini (GEMINI_API_KEY). المسار (route)
 * يجرّبهم بالتسلسل — تعثُّر الأول ينتقل للثاني بدل السقوط للتجريبي،
 * ولا يعود للوضع التجريبي إلا بعد استنفادهم جميعاً (أو غياب المفاتيح).
 */
export function getLyricsAssistants(): LyricsAssistant[] {
  const list: LyricsAssistant[] = [];
  if (process.env.ANTHROPIC_API_KEY) list.push(claudeAssistant(process.env.ANTHROPIC_API_KEY));
  if (process.env.GEMINI_API_KEY) list.push(geminiAssistant(process.env.GEMINI_API_KEY));
  return list;
}

export { mockAssistant };
