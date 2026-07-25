import { NextRequest, NextResponse } from "next/server";
import { VOICES } from "@/lib/voices";
import { elevenLabsSpeechToSpeech } from "@/lib/providers/elevenlabs";
import { mockTTS } from "@/lib/providers";
import { getCustomVoice } from "@/lib/customVoices";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** تحويل صوت إلى صوت: أداء المستخدم المسجّل بصوت آخر مع الحفاظ على النبرة والتوقيت */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "sts", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const form = await req.formData().catch(() => null);
  const audio = form?.get("audio");
  const voiceId = form?.get("voiceId");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "أرفق تسجيلاً صوتياً أولاً" }, { status: 400 });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: "الحد الأقصى لحجم التسجيل 25 ميغابايت" }, { status: 400 });
  }

  // الصوت الهدف: من الكتالوج أو من الأصوات المستنسخة للمستخدم
  let targetElevenId: string | undefined;
  if (typeof voiceId === "string") {
    targetElevenId = VOICES.find((v) => v.id === voiceId)?.elevenVoiceId;
    if (!targetElevenId && voiceId.startsWith("clone-")) {
      const custom = await getCustomVoice(voiceId.replace(/^clone-/, ""), user?.id ?? null);
      targetElevenId = custom?.id;
    }
  }
  if (!targetElevenId) {
    return NextResponse.json({ error: "اختر صوتاً هدفاً صالحاً" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    // وضع تجريبي: نغمة بديلة ليبقى المسار قابلاً للتجربة
    const mock = await mockTTS.synthesize({ text: "", voiceId: "" });
    return new NextResponse(new Uint8Array(mock.audio), {
      headers: { "Content-Type": mock.mimeType, "X-Mock": "1" },
    });
  }

  try {
    const result = await elevenLabsSpeechToSpeech(apiKey, targetElevenId, audio);
    await logUsage("sts", user?.id ?? null);
    return new NextResponse(new Uint8Array(result.audio), {
      headers: { "Content-Type": result.mimeType, "X-Mock": "0" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر التحويل";
    console.error("STS failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
