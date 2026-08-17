import { NextRequest, NextResponse } from "next/server";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";

export const maxDuration = 60;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

const SCHEMA = {
  type: "object",
  properties: {
    cues: {
      type: "array",
      description: "أبرز المؤثرات الصوتية التي تخدم المشهد — حتى 5",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "اسم المؤثر بالعربية للمستخدم (مثل: مطر على النافذة)" },
          prompt: {
            type: "string",
            description:
              "English sound-effect generation prompt, concrete and physical (e.g. heavy rain tapping on a glass window, distant thunder)",
          },
          durationSec: { type: "number", description: "مدة مقترحة بالثواني 1–30" },
          loop: { type: "boolean", description: "true لخلفية مستمرة (أجواء)، false للمؤثر اللحظي" },
        },
        required: ["label", "prompt", "durationSec", "loop"],
        propertyOrdering: ["label", "prompt", "durationSec", "loop"],
      },
    },
  },
  required: ["cues"],
  propertyOrdering: ["cues"],
};

/**
 * 🌩️ مقترح مؤثرات المشهد — يقرأ نص العمل الدرامي ويقترح حتى ٥ مؤثرات
 * (لحظية وخلفيات حلقية) بوصف توليد إنجليزي دقيق، ليولّدها المستخدم
 * بضغطة عبر /api/sfx ويوظفها في مونتاجه.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "drama", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "المقترح يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 6000) : "";
  if (!text) {
    return NextResponse.json({ error: "أرسل نص المشهد أولاً" }, { status: 400 });
  }

  try {
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
                {
                  text: `أنت مهندس صوت درامي. اقرأ المشهد التالي واقترح حتى 5 مؤثرات صوتية تخدمه فعلاً (لا حشو): لحظية (باب، خطوات، رعد) وخلفيات حلقية (مطر مستمر، سوق، ليل صيفي). لكل مؤثر: اسم عربي موجز، ووصف توليد إنجليزي محسوس مادي الدقة، ومدة واقعية، وهل هو حلقة خلفية.\n\nالمشهد:\n${text}`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: SCHEMA,
            temperature: 0.4,
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
    const textOut = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOut) throw new Error("استجابة فارغة");
    const data = JSON.parse(textOut) as {
      cues?: { label?: unknown; prompt?: unknown; durationSec?: unknown; loop?: unknown }[];
    };
    const cues = (Array.isArray(data.cues) ? data.cues : [])
      .filter((c) => typeof c.label === "string" && typeof c.prompt === "string")
      .slice(0, 5)
      .map((c) => ({
        label: (c.label as string).slice(0, 60),
        prompt: (c.prompt as string).slice(0, 450),
        durationSec:
          typeof c.durationSec === "number" ? Math.min(30, Math.max(1, c.durationSec)) : 6,
        loop: c.loop === true,
      }));
    return NextResponse.json({ cues });
  } catch (e) {
    console.error("SFX cues suggestion failed:", e);
    return NextResponse.json({ error: "تعذّر اقتراح المؤثرات — جرّب مجدداً" }, { status: 502 });
  }
}
