import { NextRequest, NextResponse } from "next/server";
import { elevenLabsIsolateAudio, humanizeElevenLabsError } from "@/lib/providers/elevenlabs";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** عازل الصوت: يفصل الكلام عن الضجيج والموسيقى ويعيد التسجيل نقياً */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "isolate", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

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
    return NextResponse.json(
      { error: "عازل الصوت يتطلب مفتاح ElevenLabs — غير مضبوط في هذه البيئة" },
      { status: 503 }
    );
  }

  try {
    const result = await elevenLabsIsolateAudio(apiKey, audio);
    await logUsage("isolate", user?.id ?? null);
    return new NextResponse(new Uint8Array(result.audio), {
      headers: { "Content-Type": result.mimeType, "X-Mock": "0" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر العزل";
    console.error("Audio isolation failed:", message);
    return NextResponse.json({ error: humanizeElevenLabsError(message) }, { status: 502 });
  }
}
