/**
 * غلاف الألبوم — توليد صورة غلاف من هوية الأغنية (العنوان والمقام والمزاج)
 * عبر نماذج توليد الصور في Gemini، مع سلسلة نماذج احتياطية.
 */

/**
 * سلسلة نماذج الصور بالأحدثية: المخصص من البيئة أولاً (ارفعه إلى
 * gemini-3-pro-image لجودة أعلى ونص مقروء داخل الصورة — يتطلب فوترة)،
 * ثم Flash 3.1 فـ 2.5 رجوعاً — غير المتاح للمفتاح يُتخطى تلقائياً.
 */
const MODELS = [
  ...new Set([
    process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image",
    "gemini-3.1-flash-image",
    "gemini-2.5-flash-image",
  ]),
];

export type CoverRequest = {
  title: string;
  maqamName: string;
  mood: string;
  stylePromptEn?: string;
};

function buildPrompt(req: CoverRequest): string {
  return [
    `Album cover artwork for an Arabic song titled "${req.title}".`,
    `Emotional mood: ${req.mood}. Musical maqam: ${req.maqamName}.`,
    req.stylePromptEn ? `Musical style: ${req.stylePromptEn}.` : "",
    "Rich Middle Eastern visual aesthetic: Arabic geometric patterns, calligraphy-inspired flowing shapes, oud or qanun silhouettes where fitting.",
    "Cinematic lighting, premium album art quality, square composition.",
    "No text, no letters, no words, no watermark, no logos.",
  ]
    .filter(Boolean)
    .join(" ");
}

type Part = { inlineData?: { mimeType?: string; data?: string } };

/** توليد صورة خام من برومبت كما هو — يخدم الأغلفة وتجربة وكيل البرومبتات */
export async function generateImageRaw(
  apiKey: string,
  prompt: string
): Promise<{ image: Buffer; mimeType: string }> {
  let lastError = "";
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      }
    );

    if (!res.ok) {
      lastError = `Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      // نموذج غير متاح لهذا المفتاح — جرّب التالي في السلسلة
      if (res.status === 404 || res.status === 400) continue;
      throw new Error(lastError);
    }

    const json = await res.json();
    const parts: Part[] = json?.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const mime = part.inlineData?.mimeType ?? "";
      if (part.inlineData?.data && mime.startsWith("image/")) {
        return { image: Buffer.from(part.inlineData.data, "base64"), mimeType: mime };
      }
    }
    lastError = "استجابة بلا صورة";
  }
  throw new Error(lastError || "تعذّر توليد الصورة");
}

export async function generateCover(
  apiKey: string,
  req: CoverRequest
): Promise<{ image: Buffer; mimeType: string }> {
  return generateImageRaw(apiKey, buildPrompt(req));
}
