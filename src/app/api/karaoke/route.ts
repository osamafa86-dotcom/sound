import { NextRequest, NextResponse } from "next/server";
import { elevenLabsTranscribeWords } from "@/lib/providers/elevenlabs";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** كاريوكي: تفريغ موقوت للأغنية — كل كلمة مع لحظة غنائها بالثواني */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "stt", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "الكاريوكي يتطلب مفتاح ElevenLabs" }, { status: 503 });
  }

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "أرفق الملف الصوتي أولاً" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "الحد الأقصى لحجم الملف 25 ميغابايت" }, { status: 400 });
  }

  try {
    const { text, words } = await elevenLabsTranscribeWords(apiKey, audio);
    if (!words.length) {
      return NextResponse.json(
        { error: "لم يتعرف المحرك على كلمات مغناة في هذا الملف" },
        { status: 422 }
      );
    }
    await logUsage("karaoke", user?.id ?? null);
    return NextResponse.json({ text, words });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّرت المزامنة";
    console.error("Karaoke sync failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
