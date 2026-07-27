import { NextRequest, NextResponse } from "next/server";
import { getJobsStore } from "@/lib/jobs";

/** حالة مهمة التوليد — يستعلم عنها العميل دورياً حتى الاكتمال أو الفشل */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = await getJobsStore().get(jobId);
  if (!job) {
    return NextResponse.json({ error: "المهمة غير موجودة أو انتهت صلاحيتها" }, { status: 404 });
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
  });
}
