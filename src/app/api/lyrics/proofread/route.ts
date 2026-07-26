import { NextRequest, NextResponse } from "next/server";
import { proofreadLyrics } from "@/lib/lyricsProofread";
import { parseSections, sanitizeSections } from "@/lib/songSections";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

/** التدقيق قد يطول على الأغاني الكاملة */
export const maxDuration = 120;

/** مدقق كلمات الأغاني: إملاء + تشكيل تام حسب اللهجة، بلا مساس بالبنية */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "المدقق يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "enhance", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const dialectId = typeof body?.dialectId === "string" ? body.dialectId : "";

  // يقبل مقاطع جاهزة أو نصاً حراً يقسّمه بنفسه
  let sections = sanitizeSections(body?.sections);
  if (!sections) {
    const lyrics = typeof body?.lyrics === "string" ? body.lyrics.trim().slice(0, 3000) : "";
    if (!lyrics) {
      return NextResponse.json({ error: "اكتب الكلمات أولاً" }, { status: 400 });
    }
    sections = parseSections(lyrics);
  }
  if (!sections.length) {
    return NextResponse.json({ error: "لم أجد كلمات قابلة للتدقيق" }, { status: 400 });
  }

  try {
    const result = await proofreadLyrics(apiKey, sections, dialectId);
    await logUsage("proofread", user?.id ?? null);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر التدقيق";
    return NextResponse.json(
      { error: msg.startsWith("Gemini") ? "تعذّر التدقيق — حاول مجدداً" : msg },
      { status: 502 }
    );
  }
}
