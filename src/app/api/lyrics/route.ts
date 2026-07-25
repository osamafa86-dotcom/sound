import { NextRequest, NextResponse } from "next/server";
import { DIALECTS, SONG_STYLES } from "@/lib/maqamat";
import { getLyricsAssistant, mockAssistant } from "@/lib/assistant";
import { consumeRateLimit, rateLimitFor, rateLimitKey } from "@/lib/rateLimit";
import { clientIp, getUserFromRequest } from "@/lib/serverAuth";
import type { AssistRequest, AssistResult } from "@/lib/assistant/types";

/** تأليف الكلمات عبر Claude قد يستغرق دقائق على المهام المعقدة */
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const allowed = await consumeRateLimit(
    rateLimitKey("lyrics", user?.id ?? null, clientIp(req)),
    rateLimitFor("lyrics", !!user)
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "تجاوزت الحد المسموح من طلبات المساعد مؤقتاً — حاول بعد قليل" + (user ? "" : "، أو سجّل الدخول لحدود أعلى") },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const mode = body?.mode;
  if (mode !== "write" && mode !== "improve") {
    return NextResponse.json({ error: "وضع الطلب غير صحيح" }, { status: 400 });
  }

  const idea = typeof body.idea === "string" ? body.idea.trim().slice(0, 500) : "";
  const lyrics = typeof body.lyrics === "string" ? body.lyrics.trim().slice(0, 3000) : "";
  if (mode === "write" && !idea) {
    return NextResponse.json({ error: "اكتب فكرة الأغنية أولاً" }, { status: 400 });
  }
  if (mode === "improve" && !lyrics) {
    return NextResponse.json({ error: "اكتب كلماتك أولاً ليتم تحسينها" }, { status: 400 });
  }

  const request: AssistRequest = {
    mode,
    idea,
    lyrics,
    dialectId: DIALECTS.some((d) => d.id === body.dialectId) ? body.dialectId : DIALECTS[0].id,
    styleId: SONG_STYLES.some((s) => s.id === body.styleId) ? body.styleId : SONG_STYLES[0].id,
  };

  const assistant = getLyricsAssistant();
  let result: AssistResult;
  let fallbackReason = "";

  try {
    result = await assistant.assist(request);
  } catch (e) {
    // المحرك الفعلي غير متاح (شبكة/مفتاح/رفض) — نرجع للاقتراح التجريبي
    if (assistant.id === "mock") {
      const message = e instanceof Error ? e.message : "حدث خطأ غير متوقع";
      return NextResponse.json({ error: message }, { status: 500 });
    }
    fallbackReason = e instanceof Error ? e.message : "unknown";
    console.error("Lyrics assistant failed, falling back to mock:", fallbackReason);
    result = await mockAssistant.assist(request);
  }

  return NextResponse.json({
    ...result,
    ...(fallbackReason && { fellBack: fallbackReason.slice(0, 200) }),
  });
}
