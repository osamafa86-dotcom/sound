import { getJobsStore } from "./jobs";
import { refundCredits } from "./credits";
import { getMusicProvider, mockMusic } from "./providers";
import { LyriaError } from "./providers/lyria";
import { isInstrumentalRequest } from "./providers/compositionPlan";
import { needsTashkeel, proofreadLyrics } from "./lyricsProofread";
import { joinSections, parseSections } from "./songSections";
import { SONG_SAMPLE_ONE_IN, autoEvalSong, sampleOneIn } from "./autoEval";
import { logUsage } from "./usage";
import type { AudioResult, MusicRequest } from "./providers/types";

const PROVIDER_LABELS: Record<string, string> = {
  "eleven-music": "Eleven Music",
  "lyria-clip": "Lyria 3 (معاينة)",
  "lyria-pro": "Lyria 3 Pro",
  minimax: "MiniMax Music",
  mock: "الوضع التجريبي",
};

/**
 * التشكيل التلقائي قبل التلحين — محرك الغناء ينطق النص كما كُتب حرفياً،
 * فالنص العاري من الحركات يُترك للتخمين ويتكسر أداؤه. كل كلمات مغناة تمر
 * من هنا: إن كانت بلا تشكيل كافٍ تُشكَّل تشكيلاً تاماً حسب اللهجة، ويُحفظ
 * الناتج في المهمة فتعرضه الواجهة (المحرر والكلمات) مشكّلاً كما غُنّي.
 * فشل المدقق لا يوقف التوليد أبداً — تمضي الكلمات كما وصلت.
 */
async function autoTashkeel(request: MusicRequest): Promise<MusicRequest | null> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) return null;

  try {
    if (request.sections?.length) {
      const proofed = await proofreadLyrics(geminiKey, request.sections, request.dialectId ?? "");
      return { ...request, sections: proofed.sections, lyrics: joinSections(proofed.sections!) };
    }
    // نص حر: يُدقَّق كمقاطع ثم يُعاد نصاً بلا ترويسات (كي لا تُغنّى العناوين)
    const proofed = await proofreadLyrics(
      geminiKey,
      parseSections(request.lyrics!),
      request.dialectId ?? ""
    );
    return { ...request, lyrics: proofed.sections!.map((s) => s.lyrics).join("\n\n") };
  } catch (e) {
    console.warn("auto-tashkeel failed, proceeding with raw lyrics:", e);
    return null;
  }
}

/** تنفيذ مهمة توليد أغنية في الخلفية — يُستدعى عبر after() بعد إرسال الاستجابة */
export async function runSongJob(jobId: string): Promise<void> {
  const store = getJobsStore();
  const job = await store.get(jobId);
  if (!job || job.status !== "pending") return;

  // التشكيل الكامل حسب اللهجة قبل أي تلحين — أعلى رافعة لسلامة النطق المغنّى
  const sungText = job.request.sections?.map((s) => s.lyrics).join("\n") ?? job.request.lyrics ?? "";
  if (!isInstrumentalRequest(job.request) && needsTashkeel(sungText)) {
    await store.update(jobId, {
      status: "running",
      stage: "جارٍ التشكيل الكامل للكلمات حسب اللهجة...",
    });
    const sungRequest = await autoTashkeel(job.request);
    if (sungRequest) {
      job.request = sungRequest;
      await store.saveRequest(jobId, sungRequest);
      await logUsage("proofread", job.userId);
    }
  }

  const provider = getMusicProvider({
    tier: job.tier,
    instrumental: job.request.styleId === "instrumental",
    force: job.request.forceProvider,
  });
  await store.update(jobId, {
    status: "running",
    stage: `جارٍ التلحين والتوليد عبر ${PROVIDER_LABELS[provider.id] ?? provider.id}...`,
  });

  // ١) التوليد — منفصل تماماً عن التخزين: توليد مدفوع ناجح لا يُهدر بعطل رفع
  let result: AudioResult | null = null;
  let fellBack: string | undefined;
  try {
    result = await provider.generate(job.request);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";

    // مرشّح محتوى Lyria متقلب: الكلمات نفسها تمر تارة وتُرفض أخرى (ثبت
    // إنتاجياً بكلمات وطنية ولّدها بامتياز ثم رفضها) — قبل أي بديل، محاولتان
    // إضافيتان بتلوين طفيف للبرومبت (لا يمس الكلمات) يقلب حكم الحدّيات
    if (provider.id === "lyria" && e instanceof LyriaError && e.contentRejected) {
      for (let retry = 1; retry <= 2 && !result; retry++) {
        await store.update(jobId, {
          stage: `مرشّح ليرا تردد في كلمات بريئة — محاولة ${retry + 1} من 3...`,
        });
        try {
          result = await provider.generate({
            ...job.request,
            stylePrompt: `${job.request.stylePrompt}\n(Take ${retry + 1})`,
          });
        } catch (eRetry) {
          if (!(eRetry instanceof LyriaError && eRetry.contentRejected)) break;
        }
      }
    }

    // جسر الغناء: ما أصرّ مرشّح Lyria على رفضه (كلمات وطنية بريئة غالباً)
    // يغنيه Eleven Music فعلاً — أغنية حقيقية لا سلّم تجريبي
    if (!result && provider.id === "lyria" && e instanceof LyriaError && e.contentRejected) {
      const eleven = getMusicProvider({ force: "eleven-music" });
      if (eleven.id === "eleven-music") {
        await store.update(jobId, {
          stage: "أصرّ مرشّح Lyria على الرفض — يتولى Eleven Music الغناء...",
        });
        try {
          result = await eleven.generate(job.request);
          fellBack = `${reason.slice(0, 120)} — غُنّيت عبر Eleven Music`;
        } catch (e2) {
          console.error("Eleven Music bridge failed:", e2);
        }
      }
    }

    if (!result && provider.id !== "mock") {
      // المحرك الحقيقي غير متاح (شبكة/باقة/إعداد) — معاينة سلّم المقام بديلاً
      console.error("Music provider failed, falling back to mock:", reason);
      try {
        result = await mockMusic.generate(job.request);
        fellBack = reason.slice(0, 200);
      } catch {
        result = null;
      }
    }
    if (!result) {
      await store.update(jobId, { status: "failed", stage: "فشل التوليد", error: reason });
      await refundSong(job.userId);
      return;
    }
  }

  // ٢) التخزين بإعادة محاولة — عطل الرفع العابر لا يعيد التوليد ولا يحوّله تجريبياً
  let stored = false;
  for (let attempt = 1; attempt <= 3 && !stored; attempt++) {
    try {
      await store.complete(
        jobId,
        result,
        fellBack
          ? {
              stage: result.mock
                ? "اكتمل التوليد (وضع تجريبي)"
                : "اكتمل التوليد (المحرك البديل غنّى الكلمات)",
              fellBack,
            }
          : undefined
      );
      stored = true;
    } catch (e) {
      console.error(`storing song output failed (attempt ${attempt}):`, e);
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  if (!stored) {
    await store.update(jobId, {
      status: "failed",
      stage: "فشل حفظ الناتج",
      error: "تعذّر حفظ الملف الصوتي بعد توليده — استُرد رصيدك، حاول مجدداً",
    });
    await refundSong(job.userId);
    return;
  }

  // ٣) عدالة الرصيد: ناتج تجريبي (رجوعاً أو وضعاً قسرياً) لا يُدفع مقابله
  if (result.mock || result.provider === "mock") {
    await refundSong(job.userId);
    return;
  }

  await logUsage("songs", job.userId);
  // النقد الذاتي بالعينات: حكم Gemini الصوتي على الالتزام المقامي
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && sampleOneIn(SONG_SAMPLE_ONE_IN)) {
    await autoEvalSong({
      geminiKey,
      audio: result.audio,
      mimeType: result.mimeType,
      maqamId: job.request.maqamId,
      variantId: job.request.variantId,
    });
  }
}

/** استرداد كلفة الأغنية للمسجل — الزائر لا يُخصم منه رصيد أصلاً */
async function refundSong(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    await refundCredits(userId, "songs");
  } catch (e) {
    console.error("song refund failed:", e);
  }
}
