import { NextRequest, NextResponse } from "next/server";
import { testImagePrompt } from "@/lib/promptTest";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 90;

/** التجربة الحية: توليد صورة فعلية بالبرومبت + حكم رؤية عليها مقابل الطلب */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "التجربة الحية تتطلب مفتاح Gemini" }, { status: 503 });
  }

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "promptTest", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 4000) : "";
  const negativePrompt =
    typeof body?.negativePrompt === "string" ? body.negativePrompt.slice(0, 1000) : undefined;
  if (!brief || !prompt) {
    return NextResponse.json({ error: "البرومبت والطلب الأصلي مطلوبان" }, { status: 400 });
  }

  try {
    const result = await testImagePrompt(apiKey, brief, prompt, negativePrompt);
    await logUsage("promptTest", user?.id ?? null);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّرت التجربة";
    return NextResponse.json(
      { error: msg.startsWith("Gemini") ? "تعذّرت التجربة — حاول مجدداً" : msg },
      { status: 502 }
    );
  }
}
