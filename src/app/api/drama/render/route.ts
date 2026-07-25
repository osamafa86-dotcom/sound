import { NextRequest, NextResponse } from "next/server";
import { renderDrama } from "@/lib/drama/render";
import { DRAMA_LIMITS, type DramaScript } from "@/lib/drama/types";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";

/** إنتاج عمل من عشرات الأسطر يحتاج مهلة كاملة */
export const maxDuration = 300;

/** المرحلة 2: السيناريو ← ملف صوتي واحد متعدد الأصوات */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "drama", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "الإنتاج يتطلب مفتاح ElevenLabs" }, { status: 503 });
  }

  const script = (await req.json().catch(() => null)) as DramaScript | null;
  if (!script?.lines?.length || !script?.characters?.length) {
    return NextResponse.json({ error: "السيناريو غير صالح" }, { status: 400 });
  }
  if (script.lines.length > DRAMA_LIMITS.maxLines) {
    return NextResponse.json(
      { error: `الحد الأقصى ${DRAMA_LIMITS.maxLines} سطراً في العمل الواحد` },
      { status: 400 }
    );
  }

  try {
    const { audio, durationSec } = await renderDrama(key, script);
    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/wav",
        "X-Duration": durationSec.toFixed(1),
        "X-Lines": String(script.lines.length),
        "X-Voices": String(new Set(script.characters.map((c) => c.voiceId)).size),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذّر إنتاج العمل" },
      { status: 502 }
    );
  }
}
