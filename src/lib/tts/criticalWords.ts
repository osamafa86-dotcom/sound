import { hasDiacritics } from "@/lib/arabic/ipa";
import { geminiStructured } from "@/lib/retryFetch";
import { withTimeout } from "@/lib/timeout";

/**
 * الكلمات الحساسة في نص مشكول — التي قد يقرؤها محرك النطق بأشهر قراءة
 * لرسمها لو تجاوز حركاتها: الأعلام (أُحُد)، والكلمات التي يتغير معناها
 * بحركاتها (عِلْم/عَلَم)، والمبني للمجهول، والفصيح النادر. تُفرض هذه وحدها
 * بالكتابة الصوتية، ويبقى سائر النص عربياً كما هو فلا يتأثر إيقاعه.
 */

/** قاعدة مشتركة لكاتب السيناريو ولمحلل استوديو النطق */
export const CRITICAL_WORDS_RULE =
  "الكلمات الحساسة للنطق: كل كلمة قد يقرؤها محرك صوتي بأشهر قراءة لرسمها لو تجاهل تشكيلها — " +
  "الأعلام وأسماء الأماكن والمعارك والأشخاص (أُحُد)، والكلمات التي يتغير معناها بحركاتها (عِلْم/عَلَم، دِين/دَين)، " +
  "والأفعال المبنية للمجهول، والألفاظ الفصيحة النادرة. اكتب كل كلمة كما وردت في النص حرفياً بتشكيلها الكامل، " +
  "ولا تُدرج الكلمات الشائعة الواضحة.";

const MAX_WORDS = 40;
const MAX_TEXT_CHARS = 8000;
/** مهلة التحليل في استوديو النطق — فشلها لا يوقف التوليد */
const TIMEOUT_MS = 8000;

const SCHEMA = {
  type: "object",
  properties: {
    words: { type: "array", items: { type: "string" }, description: "الكلمات الحساسة كما وردت في النص حرفياً" },
  },
  required: ["words"],
};

/** يُبقي ما ورد في النص فعلاً بتشكيله (لا كلمات مخترعة أو معدّلة) */
export function keepPresent(words: unknown, text: string, max = MAX_WORDS): string[] {
  if (!Array.isArray(words)) return [];
  const seen = new Set<string>();
  for (const w of words) {
    if (typeof w !== "string") continue;
    const word = w.trim();
    if (word && word.length <= 40 && hasDiacritics(word) && text.includes(word)) seen.add(word);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/**
 * يستخرج الكلمات الحساسة من نص مشكول عبر سلسلة كتّاب Gemini. نص بلا تشكيل
 * لا شيء فيه يُفرض، وأي فشل أو بطء يعيد قائمة فارغة — النطق يمضي كما كان.
 */
export async function findCriticalWords(apiKey: string, text: string): Promise<string[]> {
  if (!hasDiacritics(text) || text.length > MAX_TEXT_CHARS) return [];
  try {
    return await withTimeout(
      geminiStructured(
        apiKey,
        {
          contents: [
            {
              role: "user",
              parts: [{ text: `${CRITICAL_WORDS_RULE}\n\nاستخرج الكلمات الحساسة من هذا النص:\n"""\n${text}\n"""` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            temperature: 0.1,
            maxOutputTokens: 2048,
          },
        },
        (json) => {
          const out = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })
            ?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!out) throw new Error("استجابة فارغة");
          return keepPresent((JSON.parse(out) as { words?: unknown }).words, text);
        }
      ),
      TIMEOUT_MS
    );
  } catch (e) {
    console.error("Critical words analysis skipped:", e instanceof Error ? e.message : e);
    return [];
  }
}
