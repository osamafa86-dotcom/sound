import { NextRequest, NextResponse, after } from "next/server";
import { getTTSProvider, mockTTS } from "@/lib/providers";
import { getVoiceTuning } from "@/lib/brain";
import { TTS_SAMPLE_ONE_IN, autoEvalTTS, sampleOneIn } from "@/lib/autoEval";
import { getCustomVoice } from "@/lib/customVoices";
import { applyPronunciationRules, listRules } from "@/lib/pronunciation";
import { classifyStyle, getStyle, layerTagPrefix, styleTagPrefix } from "@/lib/performance/styles";
import { hasAudioTags } from "@/lib/performance/tags";
import { elevenLabsTranscribe } from "@/lib/providers/elevenlabs";
import { pronunciationAccuracy } from "@/lib/textCompare";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";
import type { AudioResult, TTSRequest } from "@/lib/providers/types";

/** النصوص الطويلة والتوليد المتعدد يستغرقان وقتاً — مهلة موسّعة على Vercel */
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "tts", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  let text: string = body?.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
  }
  // النصوص الطويلة تُقسَّم عند حدود الجمل وتُدمج تلقائياً — يدعم الكتب الصوتية
  if (text.length > 20000) {
    return NextResponse.json({ error: "الحد الأقصى 20000 حرف" }, { status: 400 });
  }

  const voiceId: string = body?.voiceId ?? "";

  // الأصوات المستنسخة (clone-xxx): تُحل من سجل المستخدم وتمرر معرّفها مباشرة
  let elevenVoiceId: string | undefined;
  if (voiceId.startsWith("clone-")) {
    const custom = await getCustomVoice(voiceId.replace(/^clone-/, ""), user?.id ?? null);
    if (!custom) {
      return NextResponse.json({ error: "الصوت المستنسخ غير موجود أو ليس ملكك" }, { status: 404 });
    }
    elevenVoiceId = custom.id;
  }

  // أسلوب الأداء: صريح، أو «تلقائي» يحلله Gemini من النص نفسه
  const geminiKey = process.env.GEMINI_API_KEY;
  let styleId = typeof body?.styleId === "string" ? body.styleId : "";
  if (styleId === "auto" && geminiKey) {
    styleId = (await classifyStyle(geminiKey, text)) ?? "";
  }
  const style = getStyle(styleId);

  // قاعدة الطبقات: حالة جسدية وبيئة صوتية تتراكب فوق الأسلوب الأساسي
  const layerIds: string[] = Array.isArray(body?.layerIds)
    ? body.layerIds.filter((l: unknown) => typeof l === "string").slice(0, 4)
    : [];
  const layersPrefix = layerTagPrefix(layerIds);

  // موجه المخرج الحر — توجيه إضافي يُحقن كوسم (بلا أقواس متداخلة أو أسطر)
  const directorNote =
    typeof body?.directorNote === "string"
      ? body.directorNote.replace(/[[\]\n\r]/g, " ").trim().slice(0, 200)
      : "";

  // المحرك التعبيري يُفعَّل بأسلوب أو طبقات أو موجه أو وسوم داخل النص أو طلب صريح
  const expressive =
    body?.expressive === true ||
    !!style ||
    !!layersPrefix ||
    !!directorNote ||
    (body?.expressive !== false && hasAudioTags(text));

  // الجيل الثالث لا يدعم قواميس النطق — ذاكرة النطق تُطبَّق نصياً قبل التوليد
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (expressive && elevenKey) {
    const rules = await listRules(elevenKey).catch(() => []);
    if (rules.length) text = applyPronunciationRules(text, rules);
  }

  const request: TTSRequest = {
    text,
    voiceId,
    elevenVoiceId,
    // ثبات الأسلوب المضبوط مخبرياً يتقدم حين لا يحدد المستخدم شيئاً
    stability: body?.stability ?? style?.stability,
    speed: body?.speed,
    format: body?.format,
    expressive,
    // بادئة مركّبة: أسلوب + طبقات + موجه المخرج — بترتيب العموم فالخصوص
    stylePrefix:
      [style ? styleTagPrefix(style) : "", layersPrefix, directorNote ? `[${directorNote}]` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
    liveliness: Number.isFinite(body?.liveliness) ? Number(body.liveliness) : undefined,
    speakerBoost: body?.speakerBoost !== false,
  };

  // عقل المنصة: عند غياب الإعدادات تُطبَّق القيم المتعلمة من التوليدات عالية التقييم
  if (request.stability === undefined || request.speed === undefined) {
    const learned = (await getVoiceTuning()).get(voiceId);
    if (learned) {
      request.stability ??= learned.stability;
      request.speed ??= learned.speed;
    }
  }

  // التوليد المتعدد: نسخ إضافية تستهلك من الحد وتُرتَّب آلياً بدقة النطق
  let takes = Number.isInteger(body?.takes) ? Math.min(3, Math.max(1, body.takes)) : 1;
  for (let extra = 1; extra < takes; extra++) {
    const more = await checkLimit(req, "tts", user?.id ?? null);
    if (!more.allowed) {
      takes = extra;
      break;
    }
  }

  const provider = getTTSProvider(voiceId);

  if (takes === 1) {
    let result: AudioResult;
    let fallbackReason = "";
    try {
      result = await provider.synthesize(request);
      if (provider.id !== "mock") {
        await logUsage("tts", user?.id ?? null);
        // النقد الذاتي بالعينات: تفريغ الناتج ومقارنته بالنص — بعد إرسال الاستجابة
        if (elevenKey && sampleOneIn(TTS_SAMPLE_ONE_IN)) {
          const snapshot = { audio: result.audio, mimeType: result.mimeType };
          after(() =>
            autoEvalTTS({
              apiKey: elevenKey,
              text,
              voiceId,
              audio: snapshot.audio,
              mimeType: snapshot.mimeType,
            })
          );
        }
      }
    } catch (e) {
      // المحرك الحقيقي غير متاح (شبكة/رصيد/إعداد) — نرجع للوضع التجريبي بدل كسر التجربة
      if (provider.id === "mock") throw e;
      fallbackReason = e instanceof Error ? e.message : "unknown";
      console.error("TTS provider failed, falling back to mock:", fallbackReason);
      result = await mockTTS.synthesize(request);
    }

    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        "Content-Type": result.mimeType,
        "X-Provider": result.provider,
        "X-Mock": result.mock ? "1" : "0",
        ...(fallbackReason && { "X-Fallback": encodeURIComponent(fallbackReason.slice(0, 200)) }),
      },
    });
  }

  // مسار التوليد المتعدد — استجابة JSON بكل النسخ ودرجاتها
  try {
    const results = await Promise.all(
      Array.from({ length: takes }, () => provider.synthesize(request))
    );
    if (provider.id !== "mock") await logUsage("tts", user?.id ?? null, takes);

    // الترشيح الآلي: تفريغ كل نسخة ومقارنتها بالنص (للنصوص القصيرة اقتصادياً)
    let scores: (number | null)[] = results.map(() => null);
    if (elevenKey && provider.id !== "mock" && text.length <= 600) {
      scores = await Promise.all(
        results.map(async (r) => {
          try {
            const transcript = await elevenLabsTranscribe(
              elevenKey,
              new Blob([new Uint8Array(r.audio)], { type: r.mimeType })
            );
            return pronunciationAccuracy(text, transcript);
          } catch {
            return null;
          }
        })
      );
    }

    const takesPayload = results
      .map((r, i) => ({
        audio: r.audio.toString("base64"),
        mimeType: r.mimeType,
        score: scores[i],
      }))
      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    return NextResponse.json({
      takes: takesPayload,
      provider: results[0].provider,
      mock: !!results[0].mock,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر التوليد";
    console.error("Multi-take TTS failed:", message);
    return NextResponse.json({ error: "تعذّر التوليد المتعدد — جرّب نسخة واحدة" }, { status: 502 });
  }
}
