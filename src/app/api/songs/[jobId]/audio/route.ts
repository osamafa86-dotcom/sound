import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

/** جلب الملف الصوتي لمهمة مكتملة */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json({ error: "المهمة غير موجودة أو انتهت صلاحيتها" }, { status: 404 });
  }
  if (job.status !== "done" || !job.result) {
    return NextResponse.json({ error: "المهمة لم تكتمل بعد" }, { status: 409 });
  }

  return new NextResponse(new Uint8Array(job.result.audio), {
    headers: {
      "Content-Type": job.result.mimeType,
      "Cache-Control": "private, max-age=1800",
    },
  });
}
