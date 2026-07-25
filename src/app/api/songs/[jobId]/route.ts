import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

/** حالة مهمة التوليد — يستعلم عنها العميل دورياً حتى الاكتمال أو الفشل */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "المهمة غير موجودة أو انتهت صلاحيتها" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    stage: job.stage,
    tier: job.tier,
    stylePrompt: job.request.stylePrompt,
    ...(job.result && {
      provider: job.result.provider,
      mock: !!job.result.mock,
      mimeType: job.result.mimeType,
    }),
    ...(job.fellBack && { fellBack: job.fellBack }),
    ...(job.error && { error: job.error }),
  });
}
