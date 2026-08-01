import { NextRequest, NextResponse } from "next/server";
import { refundCredits } from "@/lib/credits";
import { getJobsStore } from "@/lib/jobs";

/**
 * حارس المهام العالقة: موت الدالة عند حد المهلة (تجاوز maxDuration أو انهيار)
 * يترك المهمة «running» للأبد بلا من يعلن فشلها. الفحص الكسول هنا — في المسار
 * الذي يستعلم عنه العميل دورياً أصلاً — يصفّيها ويسترد رصيد صاحبها.
 * ٨ دقائق أطول من أقصى زمن شرعي (تشكيل + توليد ≤ ٣٠٠ث + رفع).
 */
const STALE_MS = 8 * 60 * 1000;

/** حالة مهمة التوليد — يستعلم عنها العميل دورياً حتى الاكتمال أو الفشل */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const store = getJobsStore();
  const job = await store.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "المهمة غير موجودة أو انتهت صلاحيتها" }, { status: 404 });
  }

  if (
    (job.status === "pending" || job.status === "running") &&
    Date.now() - job.updatedAt > STALE_MS
  ) {
    const error = "انقطع التوليد في الخادم — استُرد رصيدك، حاول مجدداً";
    await store.update(jobId, { status: "failed", stage: "انقطع التوليد", error });
    if (job.userId) await refundCredits(job.userId, "songs").catch(() => {});
    job.status = "failed";
    job.error = error;
    job.stage = "انقطع التوليد";
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    stage: job.stage,
    tier: job.tier,
    stylePrompt: job.request.stylePrompt,
    ...(job.provider && { provider: job.provider }),
    ...(job.mimeType && { mimeType: job.mimeType }),
    ...(job.mock !== undefined && { mock: job.mock }),
    ...(job.fellBack && { fellBack: job.fellBack }),
    ...(job.error && { error: job.error }),
    // يفتح زر «أعد توليد هذا المقطع فقط» في الواجهة
    ...(job.request.elevenSongId && { elevenSongId: job.request.elevenSongId }),
    // الكلمات كما غُنّيت فعلاً (بعد التشكيل التلقائي) — تتبناها الواجهة والمحرر
    ...(job.status === "done" && job.request.lyrics && { lyrics: job.request.lyrics }),
    ...(job.status === "done" && job.request.sections?.length && { sections: job.request.sections }),
  });
}
