import { NextRequest, NextResponse, after } from "next/server";
import { getTTSProvider, mockTTS } from "@/lib/providers";
import { TTS_SAMPLE_ONE_IN, autoEvalTTS, sampleOneIn } from "@/lib/autoEval";
import { elevenLabsTranscribe } from "@/lib/providers/elevenlabs";
import { minimaxTTS } from "@/lib/providers/minimax";
import { VOICES } from "@/lib/voices";
import { pronunciationAccuracy } from "@/lib/textCompare";
import { prepareTTSRequest } from "@/lib/tts/prepare";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";
import type { AudioResult } from "@/lib/providers/types";

/** النصوص الطويلة والتوليد المتعدد يستغرقان وقتاً — مهلة موسّعة على Vercel */
export const maxDuration = 180;

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "tts", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  // خط التحضير المشترك مع مسار البث: تنظيف، أسلوب، طبقات، نطق، إعدادات متعلمة
  const prepared = await prepareTTSRequest(body, user?.id ?? null);
  if ("error" in prepared) {
    return NextResponse.json({ error: prepared.error }, { status: prepared.status });
  }
  const request = prepared.request;
  const { text, voiceId } = request;
  const elevenKey = process.env.ELEVENLABS_API_KEY;

  // التوليد المتعدد: نسخ إضافية تستهلك من الحد وتُرتَّب آلياً بدقة النطق
  const takesRaw = body?.takes;
  let takes =
    typeof takesRaw === "number" && Number.isInteger(takesRaw)
      ? Math.min(3, Math.max(1, takesRaw))
      : 1;
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
      if (provider.id === "mock") throw e;
      fallbackReason = e instanceof Error ? e.message : "unknown";
      // إنقاذ حقيقي أولاً: نفاد رصيد/حصة ElevenLabs → محرك MiniMax الاقتصادي
      // ينطق فعلاً بصوت بديل من نفس الجنس (رصيده اشتراك شهري شبه مجاني)
      const mmKey = process.env.MINIMAX_API_KEY;
      const mmGroup = process.env.MINIMAX_GROUP_ID;
      if (/quota_exceeded|exceeds your quota|401/i.test(fallbackReason) && mmKey && mmGroup) {
        try {
          const wanted = VOICES.find((v) => v.id === request.voiceId);
          const alt =
            VOICES.find((v) => v.provider === "minimax" && v.gender === wanted?.gender) ??
            VOICES.find((v) => v.provider === "minimax");
          const rescued = await minimaxTTS(mmKey, mmGroup).synthesize({
            ...request,
            voiceId: alt?.id ?? request.voiceId,
          });
          await logUsage("tts", user?.id ?? null);
          return new NextResponse(new Uint8Array(rescued.audio), {
            headers: {
              "Content-Type": rescued.mimeType,
              "X-Provider": "minimax",
              "X-Mock": "0",
              "X-Fallback": encodeURIComponent(
                "نفد رصيد ElevenLabs الشهري — نُطق النص فعلياً بصوت المحرك الاقتصادي 💠 بديلاً"
              ),
            },
          });
        } catch (e2) {
          console.error("MiniMax TTS rescue failed:", e2);
        }
      }
      // مفاتيح حقيقية مضبوطة → لا صوت تجريبياً أبداً: خطأ صريح بالسبب،
      // والوضع التجريبي للبيئات غير المهيأة (بلا أي مفتاح) حصراً
      if (process.env.ELEVENLABS_API_KEY || process.env.AZURE_SPEECH_KEY) {
        console.error("TTS provider failed (no mock on configured env):", fallbackReason);
        return NextResponse.json(
          { error: "تعذّر التوليد: " + fallbackReason.slice(0, 180) + " — أعد المحاولة بعد لحظات" },
          { status: 502 }
        );
      }
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
