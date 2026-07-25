import { NextRequest, NextResponse } from "next/server";
import { getTTSProvider, mockTTS } from "@/lib/providers";
import { consumeRateLimit, rateLimitFor, rateLimitKey } from "@/lib/rateLimit";
import { clientIp, getUserFromRequest } from "@/lib/serverAuth";
import type { AudioResult, TTSRequest } from "@/lib/providers/types";

/** النصوص الطويلة تستغرق وقتاً لدى المحرك — مهلة موسّعة على Vercel */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const allowed = await consumeRateLimit(
    rateLimitKey("tts", user?.id ?? null, clientIp(req)),
    rateLimitFor("tts", !!user)
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "تجاوزت الحد المسموح من التوليدات مؤقتاً — حاول بعد قليل" + (user ? "" : "، أو سجّل الدخول لحدود أعلى") },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const text: string = body?.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "الحد الأقصى 5000 حرف" }, { status: 400 });
  }

  const request: TTSRequest = {
    text,
    voiceId: body.voiceId ?? "",
    stability: body.stability,
    speed: body.speed,
    format: body.format,
  };

  const provider = getTTSProvider();
  let result: AudioResult;
  let fallbackReason = "";

  try {
    result = await provider.synthesize(request);
  } catch (e) {
    // المحرك الحقيقي غير متاح (شبكة/رصيد/إعداد) — نرجع للوضع التجريبي بدل كسر التجربة
    if (provider.id === "mock") throw e;
    fallbackReason = e instanceof Error ? e.message : "unknown";
    console.error("TTS provider failed, falling back to mock:", fallbackReason);
    result = await mockTTS.synthesize(request);
  }

  return new NextResponse(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": result.mimeType,
      "X-Provider": result.provider,
      "X-Mock": result.mock ? "1" : "0",
      ...(fallbackReason && { "X-Fallback": encodeURIComponent(fallbackReason.slice(0, 200)) }),
    },
  });
}
