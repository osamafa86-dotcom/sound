import { claudeAssistant } from "./claude";
import { mockAssistant } from "./mock";
import type { LyricsAssistant } from "./types";

/**
 * اختيار المساعد حسب المفاتيح المتوفرة في البيئة:
 * وجود ANTHROPIC_API_KEY يفعّل Claude الفعلي، وغيابه يعيد الوضع التجريبي.
 * المسار (route) يتكفل بالرجوع للوضع التجريبي إذا فشل المحرك الفعلي.
 */
export function getLyricsAssistant(): LyricsAssistant {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? claudeAssistant(key) : mockAssistant;
}

export { mockAssistant };
