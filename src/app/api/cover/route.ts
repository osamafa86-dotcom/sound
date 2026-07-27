import { NextRequest, NextResponse } from "next/server";
import { MAQAMAT } from "@/lib/maqamat";
import { generateCover } from "@/lib/coverArt";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 60;

/** غلاف الألبوم: من هوية الأغنية (العنوان والمقام) إلى صورة غلاف احترافية */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "توليد الغلاف يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "cover", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 150) : "أغنية عربية";
  const maqam = MAQAMAT.find((m) => m.id === body?.maqamId) ?? MAQAMAT[0];
  const stylePromptEn =
    typeof body?.stylePrompt === "string" ? body.stylePrompt.slice(0, 400) : undefined;

  try {
    const { image, mimeType } = await generateCover(apiKey, {
      title,
      maqamName: `${maqam.name} (${maqam.mood})`,
      mood: maqam.mood,
      stylePromptEn,
    });
    await logUsage("cover", user?.id ?? null);
    return new NextResponse(new Uint8Array(image), {
      headers: { "Content-Type": mimeType, "Cache-Control": "no-store" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر توليد الغلاف";
    console.error("Cover generation failed:", message);
    return NextResponse.json(
      { error: message.startsWith("Gemini") ? "تعذّر توليد الغلاف — حاول مجدداً" : message },
      { status: 502 }
    );
  }
}
