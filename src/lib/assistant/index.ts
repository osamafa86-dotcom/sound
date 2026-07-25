import { claudeAssistant } from "./claude";
import { geminiAssistant } from "./gemini";
import { mockAssistant } from "./mock";
import type { LyricsAssistant } from "./types";

/**
 * اختيار مساعد الكلمات حسب المفاتيح المتوفرة في البيئة، بالأولوية:
 * Claude (ANTHROPIC_API_KEY) ← Gemini (GEMINI_API_KEY) ← الوضع التجريبي.
 * المسار (route) يتكفل بالرجوع للوضع التجريبي إذا فشل المحرك الفعلي.
 */
export function getLyricsAssistant(): LyricsAssistant {
  if (process.env.ANTHROPIC_API_KEY) return claudeAssistant(process.env.ANTHROPIC_API_KEY);
  if (process.env.GEMINI_API_KEY) return geminiAssistant(process.env.GEMINI_API_KEY);
  return mockAssistant;
}

export { mockAssistant };
