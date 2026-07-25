import { NextRequest, NextResponse } from "next/server";
import { enhanceText } from "@/lib/textEnhance";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";

/** التشكيل الكامل قد يستغرق وقتاً على النصوص الطويلة */
export const maxDuration = 180;

/**
 * المستشار الصوتي: يشكّل النص العربي تشكيلاً تاماً، ويطبّع الأرقام والاختصارات،
 * ويقترح الصوت والإعدادات الأنسب — أكبر رافعة لجودة النطق العربي.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "enhance", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const key = process.env.GEMINI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "المستشار الصوتي يتطلب مفتاح Gemini" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const text: string = typeof body?.text === "string" ? body.text.trim() : "";
  const dialectHint: string | undefined =
    typeof body?.dialect === "string" && body.dialect !== "الكل" ? body.dialect : undefined;

  if (!text) {
    return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json(
      { error: "الحد الأقصى للتشكيل دفعة واحدة 5000 حرف — قسّم النص" },
      { status: 400 }
    );
  }

  try {
    const result = await enhanceText(key!, text, dialectHint);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر تحليل النص";
    return NextResponse.json(
      { error: msg.startsWith("Gemini") ? "تعذّر تحليل النص — حاول مجدداً" : msg },
      { status: 502 }
    );
  }
}
