import { NextRequest, NextResponse } from "next/server";
import { getTTSProvider, mockTTS } from "@/lib/providers";
import { getCustomVoice } from "@/lib/customVoices";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";
import { AUDIOBOOK_LIMITS } from "@/lib/audiobook/types";
import type { AudioResult, TTSRequest } from "@/lib/providers/types";

/** فصل كامل قد يبلغ آلاف الحروف فيُقسَّم داخلياً إلى عدة نداءات */
export const maxDuration = 300;

/**
 * إنتاج فصل واحد من الكتاب.
 *
 * الفصل وحدة الإنتاج لا الكتاب كله: يبقى كل طلب ضمن مهلة الخادم، ويستطيع
 * المستخدم إعادة إنتاج فصل بعينه بعد تعديله دون دفع كلفة الكتاب كاملاً.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "audiobook", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const text: string = typeof body?.text === "string" ? body.text.trim() : "";
  const title: string = typeof body?.title === "string" ? body.title.trim() : "";
  const voiceId: string = typeof body?.voiceId === "string" ? body.voiceId : "";

  if (!text) {
    return NextResponse.json({ error: "نص الفصل مطلوب" }, { status: 400 });
  }
  if (text.length > AUDIOBOOK_LIMITS.maxChapterChars) {
    return NextResponse.json(
      { error: `الحد الأقصى ${AUDIOBOOK_LIMITS.maxChapterChars} حرف للفصل الواحد` },
      { status: 400 }
    );
  }

  // الصوت المستنسخ يتيح للمؤلف أن يقرأ كتابه بصوته هو — يُحلّ من سجل المستخدم
  let elevenVoiceId: string | undefined;
  if (voiceId.startsWith("clone-")) {
    const custom = await getCustomVoice(voiceId.replace(/^clone-/, ""), user?.id ?? null);
    if (!custom) {
      return NextResponse.json({ error: "الصوت المستنسخ غير موجود أو ليس ملكك" }, { status: 404 });
    }
    elevenVoiceId = custom.id;
  }

  // نطق العنوان قبل الفصل — كما تفتتح الكتب الصوتية فصولها
  const spoken = body?.announceTitle && title ? `${title}.\n\n${text}` : text;

  const request: TTSRequest = {
    text: spoken,
    voiceId,
    elevenVoiceId,
    stability: clamp(body?.stability, 0, 1, 0.65),
    speed: clamp(body?.speed, 0.7, 1.2, 1),
    format: "mp3",
  };

  const provider = getTTSProvider(voiceId);
  let result: AudioResult;
  let fallbackReason = "";

  try {
    result = await provider.synthesize(request);
    // وزن الاستهلاك بطول الفصل — الفصل الواحد يكلّف أضعاف نداء TTS القصير
    if (provider.id !== "mock") {
      await logUsage("audiobook", user?.id ?? null, Math.max(1, Math.ceil(spoken.length / 3000)));
    }
  } catch (e) {
    if (provider.id === "mock") throw e;
    fallbackReason = e instanceof Error ? e.message : "unknown";
    console.error("audiobook provider failed, falling back to mock:", fallbackReason);
    result = await mockTTS.synthesize(request);
  }

  return new NextResponse(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": result.mimeType,
      "X-Provider": result.provider,
      "X-Mock": result.mock ? "1" : "0",
      "X-Chars": String(spoken.length),
      ...(fallbackReason && { "X-Fallback": encodeURIComponent(fallbackReason.slice(0, 200)) }),
    },
  });
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
