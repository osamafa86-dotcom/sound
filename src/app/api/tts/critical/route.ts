import { NextRequest, NextResponse } from "next/server";
import { arabicToIpa, hasDiacritics } from "@/lib/arabic/ipa";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { findCriticalWords } from "@/lib/tts/criticalWords";

/**
 * 🎯 اكتشاف الكلمات الحساسة للنطق في نص المحرر — قبل التوليد، ليراجعها
 * المستخدم ويضيف أو يلغي بنقرة. كل كلمة تعود بكتابتها الصوتية كما ستُرسل.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "enhance", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "الاكتشاف الآلي يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "اكتب النص أولاً" }, { status: 400 });
  if (!hasDiacritics(text)) {
    return NextResponse.json({
      words: [],
      hint: "النص بلا تشكيل — شغّل «المستشار الصوتي» ليشكّله، ثم اكتشف الكلمات الحساسة",
    });
  }

  const words = (await findCriticalWords(key, text))
    .map((word) => ({ word, ipa: arabicToIpa(word) }))
    .filter((w): w is { word: string; ipa: string } => w.ipa !== null);
  return NextResponse.json({ words });
}
