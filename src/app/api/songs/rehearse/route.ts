import { NextRequest, NextResponse } from "next/server";
import { DIALECTS } from "@/lib/maqamat";
import { getTTSProvider } from "@/lib/providers";
import { applyPronunciationRules, listRules } from "@/lib/pronunciation";
import { proofreadLyrics } from "@/lib/lyricsProofread";
import { parseSections } from "@/lib/songSections";
import { VOICES } from "@/lib/voices";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;

/**
 * 🎧 بروفة النطق — اسمع الكلمات قبل دفع كلفة التلحين:
 * نفس خط الأنابيب الذي سيلقَّن للمولد حرفياً (ذاكرة النطق ⟵ الملقّن
 * الغنائي بالتشكيل الكامل حسب اللهجة) يُقرأ بصوت واضح، فيكتشف المستخدم
 * أي لفظ منحرف ويصححه قبل التوليد — حلقة ضبط النطق بأقصى درجاتها.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  // البروفة توليد نطق فعلي — نفس بوابة وحصة النص إلى صوت
  const verdict = await checkLimit(req, "tts", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  let lyrics = typeof body?.lyrics === "string" ? body.lyrics.trim() : "";
  if (!lyrics) {
    return NextResponse.json({ error: "اكتب الكلمات أولاً" }, { status: 400 });
  }
  if (lyrics.length > 3000) {
    return NextResponse.json({ error: "الحد الأقصى للبروفة 3000 حرف" }, { status: 400 });
  }
  const dialectId = DIALECTS.some((d) => d.id === body?.dialectId)
    ? (body.dialectId as string)
    : DIALECTS[0].id;

  // ١) ذاكرة النطق المتعلمة — كما تُطبَّق قبل كل تلحين تماماً
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey) {
    const rules = await listRules(elevenKey).catch(() => []);
    if (rules.length) lyrics = applyPronunciationRules(lyrics, rules);
  }

  // ٢) الملقّن الغنائي — التشكيل الكامل حسب اللهجة بنفس قواعد التوليد
  let dictated = lyrics;
  let issues: { original: string; fixed: string; reason: string }[] = [];
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const proofed = await proofreadLyrics(geminiKey, parseSections(lyrics), dialectId);
      dictated = proofed.sections!.map((s) => s.lyrics).filter(Boolean).join("\n\n");
      issues = proofed.issues;
      await logUsage("proofread", user?.id ?? null);
    } catch (e) {
      console.warn("rehearse proofread failed, reading raw lyrics:", e);
    }
  }

  // ٣) قراءة واضحة متأنية بصوت فصيح — لا غناء: المطلوب فحص اللفظ وحده
  const voiceId =
    typeof body?.voiceId === "string" && VOICES.some((v) => v.id === body.voiceId)
      ? (body.voiceId as string)
      : (VOICES.find((v) => v.dialect === "فصحى")?.id ?? VOICES[0].id);
  try {
    const result = await getTTSProvider(voiceId).synthesize({
      text: dictated,
      voiceId,
      stability: 0.65,
      speed: 0.92,
      format: "mp3",
    });
    if (!result.mock) await logUsage("tts", user?.id ?? null);
    return NextResponse.json({
      dictated,
      issues,
      audio: result.audio.toString("base64"),
      mimeType: result.mimeType,
      mock: !!result.mock,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّرت البروفة";
    console.error("Rehearse TTS failed:", message);
    return NextResponse.json({ error: "تعذّرت قراءة البروفة — جرّب بعد قليل" }, { status: 502 });
  }
}
