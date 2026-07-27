import { NextRequest, NextResponse } from "next/server";
import { checkLimit, limitResponse } from "@/lib/rateLimit";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/**
 * تحليل تسجيل صوتي لاستخراج النطق الصحيح لكلمة عربية.
 *
 * محركات النطق لا تقبل الصوت الخام لتعلّم النطق، لذا نستمع للتسجيل بنموذج
 * متعدد الوسائط (Gemini) ونحوّل ما سمعناه إلى نص مشكَّل + رمز صوتي IPA،
 * ثم يُحفظ كقاعدة دائمة في ذاكرة النطق.
 */
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    heardWord: { type: "string", description: "الكلمة كما سمعتها في التسجيل، بدون تشكيل" },
    vocalized: {
      type: "string",
      description:
        "الكلمة مشكّلة بالكامل (فتحة/ضمة/كسرة/سكون/شدة) بحيث تعكس نطق المتحدث في التسجيل بدقة تامة",
    },
    ipa: { type: "string", description: "النطق بالأبجدية الصوتية الدولية IPA" },
    confidence: { type: "number", description: "درجة الثقة من 0 إلى 1" },
    note: { type: "string", description: "ملاحظة موجزة بالعربية عن النطق المسموع (لهجة، تشديد، مدّ)" },
  },
  required: ["heardWord", "vocalized", "ipa", "confidence", "note"],
  propertyOrdering: ["heardWord", "vocalized", "ipa", "confidence", "note"],
};

export async function POST(req: NextRequest) {
  const limit = await checkLimit(req, "pronunciation");
  if (!limit.allowed) return limitResponse(limit);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "تحليل النطق الصوتي يتطلب مفتاح Gemini" },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const word = typeof form?.get("word") === "string" ? (form!.get("word") as string).trim() : "";

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "التسجيل الصوتي مطلوب" }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "التسجيل طويل جداً — اكتفِ بنطق الكلمة" }, { status: 400 });
  }

  const audioBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const instruction = [
    "أنت خبير في الصوتيات العربية (phonetics).",
    "في التسجيل المرفق ينطق متحدثٌ كلمةً عربية واحدة (أو عبارة قصيرة).",
    word ? `الكلمة المقصودة هي: «${word}».` : "",
    "مهمتك: اكتب الكلمة مشكّلة بالكامل بحيث تعكس نطق المتحدث في التسجيل بدقة تامة —",
    "بما في ذلك حركات الحروف والسكون والشدة والمدّ، وأي خصوصية لهجية سمعتها.",
    "التشكيل الذي تكتبه سيُستخدم لتوجيه محرك نطق آلي، فاجعله دقيقاً وصريحاً.",
    "أعطِ أيضاً النطق بالأبجدية الصوتية الدولية IPA.",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: instruction },
              { inlineData: { mimeType: file.type || "audio/wav", data: audioBase64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RESULT_SCHEMA,
          temperature: 0.2,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: "تعذّر تحليل التسجيل", detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json(
      { error: "لم يتمكن المحلّل من قراءة التسجيل — جرّب تسجيلاً أوضح" },
      { status: 502 }
    );
  }

  return NextResponse.json(JSON.parse(text));
}
