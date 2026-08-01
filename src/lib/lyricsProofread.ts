import { DIALECTS } from "./maqamat";
import { PALESTINIAN_PRONUNCIATION_GUIDE } from "./heritage/palestinian";
import { sanitizeSections, type SongSection } from "./songSections";

/**
 * مدقق كلمات الأغاني — أعلى رافعة لسلامة النطق المغنّى:
 * محرك الغناء يقرأ النص كما كُتب، فالتشكيل الكامل الصحيح «حسب اللهجة»
 * (لا الفصحى) هو الفرق بين نطق سليم ونطق مكسور. المدقق يصحح الإملاء،
 * يشكّل كل كلمة كما تُنطق باللهجة، ويحافظ على المعنى والوزن والبنية حرفياً.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

const ARABIC_MARKS = /[ً-ْٰ]/g;
const ARABIC_LETTERS = /[ء-ي]/g;

/**
 * هل النص بحاجة لتشكيل؟ كثافة الحركات مقابل الحروف العربية —
 * محرك الغناء ينطق النص كما كُتب، والنص العاري يُترك للتخمين فيتكسر الأداء.
 * نص مشكّل مسبقاً (من المدقق أو المستخدم) يمر بلا إعادة تشكيل.
 */
export function needsTashkeel(text: string): boolean {
  const letters = text.match(ARABIC_LETTERS)?.length ?? 0;
  if (letters < 20) return false;
  const marks = text.match(ARABIC_MARKS)?.length ?? 0;
  return marks / letters < 0.15;
}

/** الهيكل الحرفي للنص: الحروف بلا حركات ولا تطويل — خط أحمر لا يعبره المدقق */
export function letterSkeleton(text: string): string {
  return text.replace(/[ً-ْٰـ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * حارس قدسية الحروف — النموذج قد «يكتب كما تُنطق» فيبدّل الحروف نفسها
 * (طير⟵ظير، البلاد⟵البلاذ) ويشوّه الكلمات التي ستُغنى حرفياً.
 * القبول كلمةً كلمة: تشكيل المدقق يُعتمد فقط حيث بقي هيكل الكلمة
 * الحرفي مطابقاً للأصل، وأي كلمة بُدّلت حروفها تعود لصورتها الأصلية.
 * اختلاف عدد الأسطر أو كلمات السطر ⟵ يبقى سطر الأصل كما هو.
 */
export function enforceLetterSkeleton(original: string, proofed: string): string {
  if (letterSkeleton(original) === letterSkeleton(proofed)) return proofed;
  const oLines = original.split("\n");
  const pLines = proofed.split("\n");
  if (oLines.length !== pLines.length) return original;
  return oLines
    .map((ol, li) => {
      const ow = ol.split(/\s+/).filter(Boolean);
      const pw = pLines[li].split(/\s+/).filter(Boolean);
      if (ow.length !== pw.length) return ol;
      return ow
        .map((w, i) => (letterSkeleton(pw[i]) === letterSkeleton(w) ? pw[i] : w))
        .join(" ");
    })
    .join("\n");
}

export type ProofreadIssue = {
  original: string;
  fixed: string;
  reason: string;
};

export type ProofreadResult = {
  lyrics: string;
  sections?: SongSection[];
  issues: ProofreadIssue[];
};

const SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      description: "المقاطع نفسها بعد التدقيق والتشكيل الكامل — بنفس الترتيب والأنواع والمدد",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["intro", "verse", "chorus", "bridge", "outro"] },
          lyrics: { type: "string", description: "أسطر المقطع مشكّلة تشكيلاً تاماً كما تُنطق باللهجة" },
          durationSec: { type: "number" },
        },
        required: ["kind", "lyrics", "durationSec"],
        propertyOrdering: ["kind", "lyrics", "durationSec"],
      },
    },
    issues: {
      type: "array",
      description: "أبرز التصحيحات (إملاء أو تشكيل مغيِّر للمعنى) — حتى 10",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          fixed: { type: "string" },
          reason: { type: "string", description: "سبب عربي موجز" },
        },
        required: ["original", "fixed", "reason"],
        propertyOrdering: ["original", "fixed", "reason"],
      },
    },
  },
  required: ["sections", "issues"],
  propertyOrdering: ["sections", "issues"],
};

function buildPrompt(sections: SongSection[], dialectId: string): string {
  const dialect = DIALECTS.find((d) => d.id === dialectId) ?? DIALECTS[0];

  return `أنت مدقق لغوي وخبير عروض غنائي متخصص في اللهجة ${dialect.name}. أمامك مقاطع أغنية ستُغنّى آلياً — المحرك ينطق النص كما كُتب حرفياً، فمهمتك أن يخرج النطق سليماً ١٠٠٪:

١. **قاعدة صارمة قبل كل شيء: الحروف مقدسة.** ممنوع منعاً باتاً تغيير أو تبديل أو حذف أي حرف من رسم الكلمة — لا ط↔ظ، لا د↔ذ، لا ت↔ة، لا دمج كلمتين ولا فصلهما. عبّر عن نطق اللهجة **بالحركات فقط فوق الحروف الأصلية كما هي**. التصحيح الإملائي مسموح فقط لخطأ إملاء صريح لا خلاف عليه (همزة أو تاء مربوطة) ويُذكر في issues.
٢. **شكّل كل كلمة تشكيلاً تاماً كما تُنطق باللهجة ${dialect.name} لا بالفصحى** — بالحركات وحدها: السكون العامي في نهايات الكلمات يُثبت، والكسرة والفتحة كما ينطقها أهل اللهجة. لا تعبّر عن النطق بتغيير الحرف أبداً.
٣. **حافظ حرفياً** على: عدد المقاطع وأنواعها ومددها وترتيبها، عدد الأسطر وعدد كلمات كل سطر، الوزن والقافية، والمعنى. لا تضف ولا تحذف ولا تعِد صياغة.
٤. أدرج في issues أبرز ما صححته (إملاء أو تشكيل يغيّر المعنى) مع السبب — حتى ١٠ فقط.
${dialect.id === "palestinian" ? `\n${PALESTINIAN_PRONUNCIATION_GUIDE}\n` : ""}
المقاطع (JSON):
${JSON.stringify(sections, null, 1)}`;
}

export async function proofreadLyrics(
  apiKey: string,
  sections: SongSection[],
  dialectId: string
): Promise<ProofreadResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(sections, dialectId) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("استجابة فارغة من المدقق");

  const data = JSON.parse(text) as { sections: unknown; issues: ProofreadIssue[] };
  const clean = sanitizeSections(data.sections);
  if (!clean || clean.length !== sections.length) {
    throw new Error("أعاد المدقق بنية مختلفة — حاول مجدداً");
  }
  // حماية: المدد والأنواع تبقى كما كانت، والحروف مقدسة مهما قال النموذج —
  // أي كلمة بدّل المدقق حروفها (لا حركاتها) تعود لصورتها الأصلية
  const merged = clean.map((s, i) => ({
    ...s,
    kind: sections[i].kind,
    durationSec: sections[i].durationSec,
    lyrics: enforceLetterSkeleton(sections[i].lyrics, s.lyrics),
  }));

  const { joinSections } = await import("./songSections");
  return {
    lyrics: joinSections(merged),
    sections: merged,
    issues: Array.isArray(data.issues) ? data.issues.slice(0, 10) : [],
  };
}
