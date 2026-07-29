import { getJobsStore } from "./jobs";
import { getMusicProvider, mockMusic } from "./providers";
import { SONG_SAMPLE_ONE_IN, autoEvalSong, sampleOneIn } from "./autoEval";
import { logUsage } from "./usage";

const PROVIDER_LABELS: Record<string, string> = {
  "eleven-music": "Eleven Music",
  "lyria-clip": "Lyria 3 (معاينة)",
  "lyria-pro": "Lyria 3 Pro",
  mock: "الوضع التجريبي",
};

/** تنفيذ مهمة توليد أغنية في الخلفية — يُستدعى عبر after() بعد إرسال الاستجابة */
export async function runSongJob(jobId: string): Promise<void> {
  const store = getJobsStore();
  const job = await store.get(jobId);
  if (!job || job.status !== "pending") return;

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
