import { NextRequest, NextResponse } from "next/server";
import { getTTSProvider, mockTTS } from "@/lib/providers";
import { getCustomVoice } from "@/lib/customVoices";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import type { AudioResult, TTSRequest } from "@/lib/providers/types";

/** النصوص الطويلة تستغرق وقتاً لدى المحرك — مهلة موسّعة على Vercel */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "tts", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const text: string = body?.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
  }
  // النصوص الطويلة تُقسَّم عند حدود الجمل وتُدمج تلقائياً — يدعم الكتب الصوتية
  if (text.length > 20000) {
    return NextResponse.json({ error: "الحد الأقصى 20000 حرف" }, { status: 400 });
  }

  const voiceId: string = body?.voiceId ?? "";

  // الأصوات المستنسخة (clone-xxx): تُحل من سجل المستخدم وتمرر معرّفها مباشرة
  let elevenVoiceId: string | undefined;
  if (voiceId.startsWith("clone-")) {
    const custom = await getCustomVoice(voiceId.replace(/^clone-/, ""), user?.id ?? null);
    if (!custom) {
      return NextResponse.json({ error: "الصوت المستنسخ غير موجود أو ليس ملكك" }, { status: 404 });
    }
    elevenVoiceId = custom.id;
  }

  const request: TTSRequest = {
    text,
    voiceId,
    elevenVoiceId,
    stability: body.stability,
    speed: body.speed,
    format: body.format,
  };

  const provider = getTTSProvider(voiceId);
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
