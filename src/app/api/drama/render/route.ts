import { NextRequest, NextResponse } from "next/server";
import { renderDrama } from "@/lib/drama/render";
import { DRAMA_LIMITS, type DramaScript } from "@/lib/drama/types";
import { elevenLabsMusic } from "@/lib/providers/elevenlabs";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

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

  const script = (await req.json().catch(() => null)) as
    | (DramaScript & { introMusic?: boolean })
    | null;
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
    // ثيم الافتتاح يُولَّد بالتوازي مع الحوار — لا يضيف زمن انتظار يُذكر
    const themePromise: Promise<Buffer | null> =
      script.introMusic && script.musicPromptEn
        ? elevenLabsMusic(key)
            .generate({
              maqamId: script.maqamId,
              styleId: "instrumental",
              instrumentIds: [],
              stylePrompt: script.musicPromptEn,
              durationSec: 15,
            })
            .then((r) => r.audio)
            .catch((e) => {
              // فشل الموسيقى لا يُسقط الحلقة — تصدر بلا ثيم
              console.error("Podcast theme failed:", e instanceof Error ? e.message : e);
              return null;
            })
        : Promise.resolve(null);

    const [{ audio: speech, durationSec }, theme] = await Promise.all([
      renderDrama(key, script),
      themePromise,
    ]);
    await logUsage("drama", user?.id ?? null, script.lines.length);

    // الثيم نفسه افتتاحاً وختاماً — هوية صوتية موحدة للحلقة بلا توليد إضافي
    const audio = theme ? Buffer.concat([theme, speech, theme]) : speech;
    const totalSec = durationSec + (theme ? 30 : 0);

    return new NextResponse(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Duration": totalSec.toFixed(1),
        "X-Lines": String(script.lines.length),
        "X-Voices": String(new Set(script.characters.map((c) => c.voiceId)).size),
        ...(theme && { "X-Theme": "1" }),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذّر إنتاج العمل" },
      { status: 502 }
    );
  }
}
