import { NextRequest, NextResponse } from "next/server";
import { analyzeDrama } from "@/lib/drama/analyze";
import { DRAMA_LIMITS } from "@/lib/drama/types";
import { ANY_DIALECT, DIALECT_OPTIONS } from "@/lib/dialects";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";

/** تحليل نص طويل إلى سيناريو قد يستغرق دقيقة */
export const maxDuration = 180;

/** المرحلة 1 من الاستوديو الدرامي: نص ← سيناريو بشخصيات وأصوات وانفعالات */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "drama", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "الاستوديو الدرامي يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const text: string = typeof body?.text === "string" ? body.text.trim() : "";
  const dialect: string =
    typeof body?.dialect === "string" && DIALECT_OPTIONS.includes(body.dialect) ? body.dialect : ANY_DIALECT;

  if (!text) return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
  if (text.length > DRAMA_LIMITS.maxInputChars) {
    return NextResponse.json(
      { error: `الحد الأقصى ${DRAMA_LIMITS.maxInputChars} حرف — قسّم النص إلى مشاهد` },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await analyzeDrama(key, text, dialect));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر تحليل النص";
    return NextResponse.json(
      { error: msg.startsWith("Gemini") ? "تعذّر تحليل النص — حاول مجدداً" : msg },
      { status: 502 }
    );
  }
}
