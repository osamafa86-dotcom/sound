import { NextRequest, NextResponse } from "next/server";
import { PROMPT_TYPES, craftPrompt } from "@/lib/promptSmith";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 60;

/** مهندس البرومبتات: نوع مادة + طلب حر ← برومبت احترافي جاهز للصق */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "مهندس البرومبتات يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "prompts", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const typeId = typeof body?.typeId === "string" ? body.typeId : "";
  const type = PROMPT_TYPES.find((t) => t.id === typeId);
  if (!type) {
    return NextResponse.json({ error: "اختر نوع البرومبت" }, { status: 400 });
  }

  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  if (!brief) {
    return NextResponse.json({ error: "صف ما تريد إنتاجه أولاً" }, { status: 400 });
  }
  // المنصة تُقبل من قائمة النوع نفسها فقط
  const platform =
    typeof body?.platform === "string" && type.platforms.includes(body.platform)
      ? body.platform
      : undefined;

  try {
    const crafted = await craftPrompt(apiKey, typeId, brief, platform);
    await logUsage("prompts", user?.id ?? null);
    return NextResponse.json(crafted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّرت الصياغة";
    return NextResponse.json(
      { error: msg.startsWith("Gemini") ? "تعذّرت الصياغة — حاول مجدداً" : msg },
      { status: 502 }
    );
  }
}
