import { MAQAMAT } from "@/lib/maqamat";

/**
 * من صورة إلى موسيقى — عين المنصة.
 *
 * نموذج رؤية متعدد الوسائط يقرأ الصورة (مشهد، لوحة، صورة شخصية...)
 * ويحوّل مزاجها وقصتها إلى موجز موسيقي: المقام الأنسب لطابعها،
 * ووصف عربي لما استُلهم منها، وبرومبت إنجليزي احترافي لمحرك التوليد.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export type ImageBrief = {
  /** عنوان مقترح للمقطوعة بالعربية */
  titleAr: string;
  /** ما قرأه النموذج في الصورة وكيف ترجمه موسيقياً */
  descriptionAr: string;
  maqamId: string;
  maqamReason: string;
  stylePromptEn: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    titleAr: { type: "string", description: "عنوان قصير وشاعري للمقطوعة بالعربية" },
    descriptionAr: {
      type: "string",
      description: "وصف عربي في جملتين أو ثلاث: ما الذي تراه في الصورة وما المزاج الذي استلهمته منها موسيقياً",
    },
    maqamId: { type: "string", enum: MAQAMAT.map((m) => m.id) },
    maqamReason: { type: "string", description: "تعليل اختيار المقام بالعربية في جملة واحدة" },
    stylePromptEn: {
      type: "string",
      description:
        "Professional English music-generation prompt translating the image's mood: maqam name, quarter tones if applicable, Arabic instruments, rhythm, tempo, dynamics, structure. One dense paragraph under 400 characters.",
    },
  },
  required: ["titleAr", "descriptionAr", "maqamId", "maqamReason", "stylePromptEn"],
  propertyOrdering: ["titleAr", "descriptionAr", "maqamId", "maqamReason", "stylePromptEn"],
};

function buildPrompt(): string {
  const maqamList = MAQAMAT.map(
    (m) => `- ${m.id}: مقام ${m.name} — الطابع: ${m.mood}. ${m.description}`
  ).join("\n");

  return `أنت مؤلف موسيقي عربي محترف وخبير في علم المقامات، تعمل داخل منصة «لحّن».

انظر إلى الصورة المرفقة بعين الموسيقي: المكان والزمان والضوء والألوان والوجوه والحركة، ثم ترجم إحساسها إلى موجز موسيقي:
1. عنوان شاعري قصير للمقطوعة بالعربية.
2. وصف عربي موجز لما رأيته وما المزاج الذي استلهمته منه.
3. المقام الأنسب لطابع الصورة من القائمة التالية حصراً (استخدم قيمة id كما هي):
${maqamList}
4. برومبت موسيقي احترافي بالإنجليزية لمحرك التوليد: المقام وأرباع النغمات إن وُجدت، الآلات الشرقية المناسبة للمشهد، الإيقاع والسرعة والديناميكية وبنية المقطوعة.

المطلوب موسيقى آلية بلا غناء — اجعل البرومبت يعكس الصورة لا قالباً عاماً.`;
}

export async function imageToMusicBrief(
  apiKey: string,
  imageBase64: string,
  mimeType: string
): Promise<ImageBrief> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType, data: imageBase64 } },
              { text: buildPrompt() },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.8,
          maxOutputTokens: 2048,
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
  if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
    throw new Error("تعذّر تحليل هذه الصورة — جرّب صورة أخرى");
  }

  const text = candidate?.content?.parts?.[0]?.text;
  if (!text) throw new Error("استجابة فارغة من محلل الصور");

  const data = JSON.parse(text) as ImageBrief;
  // حماية فوق المخطط: تأكيد أن المقام المُرجَع موجود فعلاً في قائمتنا
  const maqamId = MAQAMAT.some((m) => m.id === data.maqamId) ? data.maqamId : MAQAMAT[0].id;
  return { ...data, maqamId, stylePromptEn: data.stylePromptEn.slice(0, 700) };
}
