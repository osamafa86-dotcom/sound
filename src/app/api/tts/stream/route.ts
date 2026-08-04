import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsError, elevenLabsTTSStream } from "@/lib/providers/elevenlabs";
import { splitTextForTTS } from "@/lib/tts/split";
import { prepareTTSRequest } from "@/lib/tts/prepare";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

/** البث يمتد بامتداد التوليد نفسه لدى المحرك — نفس مهلة المسار المخزّن */
export const maxDuration = 180;

/**
 * 🚀 توليد نطق متدفق — القطع الصوتية تُمرَّر للمتصفح فور خروجها من
 * المحرك فيبدأ التشغيل خلال أجزاء ثانية بدل انتظار الملف كاملاً.
 * حصراً للمسار السريع: نص بقطعة واحدة، صيغة mp3، صوت ElevenLabs —
 * وما عداه يرد 400 فيرجع العميل تلقائياً لمسار /api/tts المخزّن.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";

  // البوابات البنيوية قبل حجز الحصة — غير القابل للبث لا يستهلك من الحد
  if (!apiKey) {
    return NextResponse.json({ error: "البث المتدفق يتطلب مفتاح ElevenLabs" }, { status: 503 });
  }
  if (!text) {
    return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
  }
  if (body?.format === "wav" || splitTextForTTS(text).length !== 1) {
    return NextResponse.json({ error: "هذا الطلب لا يُبث تدفقياً" }, { status: 400 });
  }

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "tts", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const prepared = await prepareTTSRequest(body, user?.id ?? null);
  if ("error" in prepared) {
    return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  }

  try {
    const upstream = await elevenLabsTTSStream(apiKey, prepared.request);
    await logUsage("tts", user?.id ?? null);
    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Provider": "elevenlabs",
        "X-Mock": "0",
        "Cache-Control": "no-store",
        // منع أي وسيط من تجميع البث قبل تمريره
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    const status = e instanceof ElevenLabsError && e.status === 400 ? 400 : 502;
    const message = e instanceof Error ? e.message : "تعذّر البث";
    console.error("Streaming TTS failed:", message);
    return NextResponse.json(
      { error: status === 400 ? message : "تعذّر البث المتدفق — جرّب مجدداً" },
      { status }
    );
  }
}
