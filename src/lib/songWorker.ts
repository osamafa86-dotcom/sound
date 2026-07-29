import { getJobsStore } from "./jobs";
import { getMusicProvider, mockMusic } from "./providers";
import { isInstrumentalRequest } from "./providers/compositionPlan";
import { needsTashkeel, proofreadLyrics } from "./lyricsProofread";
import { joinSections, parseSections } from "./songSections";
import { SONG_SAMPLE_ONE_IN, autoEvalSong, sampleOneIn } from "./autoEval";
import { logUsage } from "./usage";
import type { MusicRequest } from "./providers/types";

const PROVIDER_LABELS: Record<string, string> = {
  "eleven-music": "Eleven Music",
  "lyria-clip": "Lyria 3 (معاينة)",
  "lyria-pro": "Lyria 3 Pro",
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

  try {
    const result = await provider.generate(job.request);
    await store.complete(jobId, result);
    if (result.provider !== "mock") {
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
  } catch (e) {
    const reason = e instanceof Error ? e.message : "unknown";
    if (provider.id === "mock") {
      await store.update(jobId, { status: "failed", stage: "فشل التوليد", error: reason });
      return;
    }
    // المحرك الحقيقي غير متاح (شبكة/باقة/إعداد) — نرجع لمعاينة سلّم المقام
    console.error("Music provider failed, falling back to mock:", reason);
    try {
      const result = await mockMusic.generate(job.request);
      await store.complete(jobId, result, {
        stage: "اكتمل التوليد (وضع تجريبي)",
        fellBack: reason.slice(0, 200),
      });
    } catch (mockError) {
      await store.update(jobId, {
        status: "failed",
        stage: "فشل التوليد",
        error: mockError instanceof Error ? mockError.message : "unknown",
      });
    }
  }
}
