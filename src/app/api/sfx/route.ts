import { NextRequest, NextResponse } from "next/server";
import { elevenLabsSoundEffect, humanizeElevenLabsError } from "@/lib/providers/elevenlabs";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 60;

/**
 * 🌩️ توليد مؤثر صوتي من وصف نصي — مطر على نافذة، باب يصرّ، جمهور يهتف...
 * وقود الاستوديو الدرامي والبودكاست ومساحة مقام: نص ⟵ مؤثر حتى ٣٠ ثانية،
 * مع خيار حلقة متكررة سلسة للخلفيات الطويلة (أجواء مستمرة).
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "sfx", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "المؤثرات الصوتية تتطلب مفتاح ElevenLabs — غير مضبوط في هذه البيئة" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 450) : "";
  if (!prompt) {
    return NextResponse.json({ error: "صف المؤثر أولاً — مثال: مطر غزير على نافذة" }, { status: 400 });
  }
  const durationSec =
    typeof body?.durationSec === "number" && Number.isFinite(body.durationSec)
      ? Math.min(30, Math.max(0.5, body.durationSec))
      : undefined;
  const loop = body?.loop === true;

  try {
    const result = await elevenLabsSoundEffect(apiKey, { prompt, durationSec, loop });
    await logUsage("sfx", user?.id ?? null);
    return new NextResponse(new Uint8Array(result.audio), {
      headers: { "Content-Type": result.mimeType, "X-Provider": "elevenlabs" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر توليد المؤثر";
    console.error("SFX generation failed:", message);
    return NextResponse.json({ error: humanizeElevenLabsError(message) }, { status: 502 });
  }
}
