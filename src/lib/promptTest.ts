import { generateImageRaw } from "./coverArt";

/**
 * التجربة الحية — الوكيل يحاور المنصة فعلاً:
 * يولّد صورة حقيقية بالبرومبت، ثم يفحصها ناقد رؤية مقابل طلب المستخدم
 * الأصلي ويسمّي الفجوات — فيتحسن البرومبت مما رأى لا مما ظن.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export type ImageTestResult = {
  imageBase64: string;
  mimeType: string;
  judgment: {
    /** 0-10: مطابقة الصورة لطلب المستخدم */
    match: number;
    /** ما خان البرومبت في الصورة الفعلية */
    gaps: string[];
    note: string;
  };
};

export async function testImagePrompt(
  apiKey: string,
  brief: string,
  prompt: string,
  negativePrompt?: string
): Promise<ImageTestResult> {
  // Midjourney-style parameters لا تفهمها مولدات Gemini — تُنزع قبل التجربة
  const cleanPrompt = prompt.replace(/--\w+[^-]*/g, "").trim();
  const fullPrompt = negativePrompt ? `${cleanPrompt}. Avoid: ${negativePrompt}` : cleanPrompt;

  const { image, mimeType } = await generateImageRaw(apiKey, fullPrompt);

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
              { inlineData: { mimeType, data: image.toString("base64") } },
              {
                text: `أنت ناقد رؤية صارم. هذه صورة وُلّدت بالبرومبت التالي:
"""${prompt}"""

وطلب المستخدم الأصلي كان:
"""${brief}"""

افحص الصورة الفعلية: ما مدى تحقيقها لطلب المستخدم (0-10)؟ وما العناصر التي طلبها البرومبت ولم تظهر أو ظهرت خطأ (gaps — حتى ٤ بالعربية، محددة قابلة للإصلاح في البرومبت)؟ وجملة حكم عامة.`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              match: { type: "number" },
              gaps: { type: "array", items: { type: "string" } },
              note: { type: "string" },
            },
            required: ["match", "gaps", "note"],
            propertyOrdering: ["match", "gaps", "note"],
          },
          temperature: 0.2,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  let judgment: ImageTestResult["judgment"] = { match: 0, gaps: [], note: "تعذّر حكم الرؤية" };
  if (res.ok) {
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const data = JSON.parse(text) as ImageTestResult["judgment"];
      judgment = {
        match: Math.min(10, Math.max(0, Math.round(Number(data.match) || 0))),
        gaps: (data.gaps ?? []).slice(0, 4),
        note: data.note ?? "",
      };
    }
  }

  return { imageBase64: image.toString("base64"), mimeType, judgment };
}
