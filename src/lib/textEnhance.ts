import { VOICES } from "@/lib/voices";

/**
 * المستشار الصوتي — أعلى رافعة لجودة النطق العربي.
 *
 * محركات TTS تخمّن حركات الحروف في النص غير المشكَّل، وكثيراً ما تخطئ:
 * «عَلَّمَ» تُقرأ «عِلْم»، و«2024» تُقرأ أرقاماً مفردة، و«د.» تُقرأ حرفاً.
 * هنا نمرّر النص على نموذج لغوي يشكّله بالكامل ويطبّع الأرقام والاختصارات
 * إلى صيغتها المنطوقة، ويقترح الصوت والإعدادات الأنسب لنوع المحتوى.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export type EnhanceResult = {
  /** النص بعد التشكيل الكامل وتطبيع الأرقام والاختصارات */
  enhanced: string;
  /** نوع المحتوى المكتشف: خبر، إعلان، سرد قصصي، تعليمي، ديني، شعر... */
  contentType: string;
  /** ملخص عربي موجز لأبرز ما عُدّل */
  changes: string;
  /** معرّف الصوت المقترح من كتالوج المنصة */
  recommendedVoiceId: string;
  /** سبب اختيار هذا الصوت */
  voiceReason: string;
  /** 0..1 — ثبات أعلى للمحتوى الرسمي، أقل للتعبيري */
  stability: number;
  /** 0.7..1.2 */
  speed: number;
};

const SCHEMA = {
  type: "object",
  properties: {
    enhanced: {
      type: "string",
      description:
        "النص كاملاً بعد التشكيل التام لكل الكلمات، وتحويل الأرقام والرموز والاختصارات إلى صيغتها المنطوقة بالعربية",
    },
    contentType: { type: "string", description: "نوع المحتوى بالعربية في كلمتين مثل: خبر رسمي، سرد قصصي، إعلان تسويقي" },
    changes: { type: "string", description: "ملخص عربي في جملة أو جملتين لأبرز التعديلات التي أجريتها" },
    recommendedVoiceId: { type: "string", enum: VOICES.map((v) => v.id) },
    voiceReason: { type: "string", description: "سبب اختيار هذا الصوت بالعربية في جملة واحدة" },
    stability: { type: "number", description: "من 0 إلى 1" },
    speed: { type: "number", description: "من 0.7 إلى 1.2" },
  },
  required: ["enhanced", "contentType", "changes", "recommendedVoiceId", "voiceReason", "stability", "speed"],
  propertyOrdering: ["enhanced", "contentType", "changes", "recommendedVoiceId", "voiceReason", "stability", "speed"],
};

function buildPrompt(text: string, dialectHint?: string): string {
  const catalog = VOICES.map(
    (v) => `- ${v.id}: ${v.name} — ${v.gender === "male" ? "ذكر" : "أنثى"}، لهجة ${v.dialect}. ${v.tone}`
  ).join("\n");

  return `أنت خبير في الصوتيات العربية وإخراج التعليق الصوتي، تعمل داخل منصة «مقام».

مهمتك على النص التالي:

**١. التشكيل الكامل** — شكّل كل كلمة تشكيلاً تاماً (فتحة/ضمة/كسرة/سكون/شدة/تنوين) بما يزيل أي لبس في القراءة. هذه أهم مهمة: محرك النطق الآلي يخطئ في النص غير المشكَّل، والتشكيل الصحيح يرفع جودة الصوت رفعاً كبيراً. انتبه بوجه خاص للأفعال المبنية للمجهول، والمضاف إليه، وهمزات الوصل والقطع.

**٢. تطبيع ما لا يُنطق كما يُكتب:**
- الأرقام إلى كلمات منطوقة بصيغتها الصحيحة إعراباً وتذكيراً/تأنيثاً (٢٠٢٤ ← أَلْفَيْنِ وَأَرْبَعَة وَعِشْرِين)
- الاختصارات إلى صيغتها الكاملة (د. ← دُكْتُور، م. ← مُهَنْدِس، ص. ← صَفْحَة)
- الرموز والوحدات (٪ ← بِالْمِئَة، $ ← دُولَار، كم ← كِيلُومِتْر)
- التواريخ والأوقات إلى صيغة منطوقة

**٣. حافظ حرفياً على:** معنى النص وترتيبه وأسلوبه ولهجته وفقراته وعلامات ترقيمه. لا تختصر ولا تُضِف ولا تُعِد الصياغة — التشكيل والتطبيع فقط.
${dialectHint ? `\nملاحظة: النص باللهجة ${dialectHint} — شكّله بما يوافق نطقها لا الفصحى.` : ""}

**٤. اقترح الصوت الأنسب** من كتالوج المنصة حصراً:
${catalog}

**٥. اقترح الإعدادات:** الثبات (stability) بين 0 و1 — ارفعه للمحتوى الرسمي والإخباري (0.6–0.8) واخفضه للسرد التعبيري والإعلانات (0.3–0.5). والسرعة (speed) بين 0.7 و1.2 — أبطأ قليلاً للمحتوى التعليمي والديني، وأسرع قليلاً للإعلانات الحيوية.

النص:
"""
${text}
"""`;
}

export async function enhanceText(
  apiKey: string,
  text: string,
  dialectHint?: string
): Promise<EnhanceResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(text, dialectHint) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.15,
          maxOutputTokens: 32000,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const candidate = json?.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("النص طويل جداً على التشكيل دفعة واحدة — قسّمه إلى أجزاء أصغر");
  }

  const out = candidate?.content?.parts?.[0]?.text;
  if (!out) throw new Error("استجابة فارغة من المستشار");

  const data = JSON.parse(out) as EnhanceResult;

  // حماية: تأكيد أن الصوت المقترح موجود فعلاً، وحصر الإعدادات في نطاقها المدعوم
  const voiceOk = VOICES.some((v) => v.id === data.recommendedVoiceId);
  return {
    ...data,
    recommendedVoiceId: voiceOk ? data.recommendedVoiceId : VOICES[0].id,
    stability: Math.min(1, Math.max(0, Number(data.stability) || 0.5)),
    speed: Math.min(1.2, Math.max(0.7, Number(data.speed) || 1)),
  };
}
