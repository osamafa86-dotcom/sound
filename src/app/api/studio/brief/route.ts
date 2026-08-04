import { NextRequest, NextResponse } from "next/server";
import { melodyToStyleBrief } from "@/lib/studio/melodyBrief";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

/**
 * موجز اللحن المرجعي — أذن المساحة: يستمع للحن المرفوع ويعيد
 * برومبتاً أسلوبياً يقود التلحين لتأليف جديد بروحه (استلهاماً لا نسخاً).
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "melodyBrief", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "أرفق اللحن المرجعي أولاً" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "الحد الأقصى لحجم اللحن 15 ميغابايت" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "تحليل اللحن يتطلب مفتاح Gemini — غير مضبوط في هذه البيئة" },
      { status: 503 }
    );
  }

  try {
    const brief = await melodyToStyleBrief(apiKey, {
      data: Buffer.from(await audio.arrayBuffer()),
      mimeType: audio.type || "audio/mpeg",
    });
    return NextResponse.json(brief);
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر تحليل اللحن";
    console.error("melody brief failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
