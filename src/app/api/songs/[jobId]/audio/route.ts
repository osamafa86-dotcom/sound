import { NextRequest, NextResponse } from "next/server";
import { getJobsStore } from "@/lib/jobs";
import { rangeResponse } from "@/lib/httpRange";

/** جلب الملف الصوتي لمهمة مكتملة — بدعم طلبات المدى (يشترطه سفاري للتشغيل) */
export async function GET(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  const store = getJobsStore();
  const job = await store.get(jobId);
  if (!job) {
    return NextResponse.json({ error: "المهمة غير موجودة أو انتهت صلاحيتها" }, { status: 404 });
  }
  if (job.status !== "done") {
    return NextResponse.json({ error: "المهمة لم تكتمل بعد" }, { status: 409 });
  }

  const audio = await store.getAudio(jobId);
  if (!audio) {
    return NextResponse.json({ error: "تعذّر جلب الملف الصوتي" }, { status: 404 });
  }

  return rangeResponse(req, audio.audio, audio.mimeType, {
    "Cache-Control": "private, max-age=1800",
  });
}
