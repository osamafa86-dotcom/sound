import { DIALECTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import type { AssistRequest, AssistResult, LyricsAssistant } from "./types";

/**
 * اختيار مقام إرشادي حسب كلمات مفتاحية في النص —
 * بديل تجريبي مبسّط عن تحليل نموذج الذكاء الاصطناعي الفعلي للمعنى والمزاج.
 */
const MOOD_RULES: { pattern: RegExp; maqamId: string }[] = [
  { pattern: /حزن|حزين|فراق|دمع|وداع|رحيل|شجن|ألم/, maqamId: "saba" },
  { pattern: /دعاء|روح|مناجا|إيمان|نور|سماء/, maqamId: "hijaz" },
  { pattern: /فرح|عيد|احتفال|نجاح|وطن|حماس/, maqamId: "ajam" },
  { pattern: /حب|غرام|عشق|رومانس|حبيب|قلب/, maqamId: "kurd" },
  { pattern: /تراث|موشح|أندلس|زمان/, maqamId: "sikah" },
  { pattern: /طرب|أصالة|سلطنة|سهر/, maqamId: "rast" },
  { pattern: /درامي|قدر|صراع|ليل/, maqamId: "nahawand" },
];

function mockLyrics(idea: string): string {
  return [
    "«مسودة تجريبية — تُستبدل بكتابة الذكاء الاصطناعي الفعلية عند ربط المفتاح»",
    "",
    "مطلع:",
    `في خاطري حكاية عن ${idea}`,
    "أحملها بقلبي وأغنّيها",
    "والكلمة الصادقة إذا غنّيتها",
    "تلقى طريق القلب وتحييها",
    "",
    "لازمة:",
    "غنّوا معي واللحن يعلا",
    "بمقامنا الشرقي نحلّق",
    "كل المشاعر صارت أهلا",
    "بالنغم العربي نتألق",
  ].join("\n");
}

export const mockAssistant: LyricsAssistant = {
  id: "mock",
  async assist(req: AssistRequest): Promise<AssistResult> {
    const text = `${req.idea ?? ""} ${req.lyrics ?? ""}`;
    const matched = MOOD_RULES.find((r) => r.pattern.test(text))?.maqamId;
    const maqam = MAQAMAT.find((m) => m.id === matched) ?? MAQAMAT[0];
    const style = SONG_STYLES.find((s) => s.id === req.styleId) ?? SONG_STYLES[0];
    const dialect = DIALECTS.find((d) => d.id === req.dialectId) ?? DIALECTS[0];

    return {
      title: "مسودة تجريبية",
      // في وضع التحسين لا يستطيع البديل التجريبي تحسين الصياغة فعلياً، فيعيد الكلمات كما هي
      lyrics: req.mode === "improve" ? (req.lyrics ?? "").trim() : mockLyrics((req.idea ?? "").trim()),
      maqamId: maqam.id,
      maqamReason: `اقتراح تجريبي مبني على كلمات مفتاحية في النص: مقام ${maqam.name} يناسب أجواء «${maqam.mood}». التحليل الدقيق للمعنى يُفعَّل مع ربط مفتاح الذكاء الاصطناعي.`,
      stylePromptEn: [
        maqam.stylePrompt,
        style.en,
        `${dialect.en} vocals`,
        "oud, qanun, darbuka rhythm, expressive Arabic singing, high quality studio production",
      ].join(", "),
      provider: "mock",
      mock: true,
    };
  },
};
