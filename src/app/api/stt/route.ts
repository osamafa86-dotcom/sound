import { NextRequest, NextResponse } from "next/server";
import { elevenLabsTranscribe } from "@/lib/providers/elevenlabs";
import { consumeRateLimit, rateLimitFor, rateLimitKey } from "@/lib/rateLimit";
import { clientIp, getUserFromRequest } from "@/lib/serverAuth";

export const maxDuration = 120;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** تفريغ صوتي: تسجيل/ملف صوتي ← نص عربي */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const allowed = await consumeRateLimit(
    rateLimitKey("stt", user?.id ?? null, clientIp(req)),
    rateLimitFor("stt", !!user)
  );
  if (!allowed) {
    return NextResponse.json({ error: "تجاوزت الحد المسموح من التفريغات مؤقتاً — حاول بعد قليل" }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "أرفق تسجيلاً صوتياً أولاً" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "الحد الأقصى لحجم التسجيل 25 ميغابايت" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      text: "«تفريغ تجريبي» — يُفعَّل التفريغ الفعلي عند ربط مفتاح ElevenLabs.",
      mock: true,
    });
  }

  try {
    const text = await elevenLabsTranscribe(apiKey, audio);
    return NextResponse.json({ text, mock: false });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر التفريغ";
    console.error("STT failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
