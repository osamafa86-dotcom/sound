import { NextRequest, NextResponse } from "next/server";
import { getJobsStore } from "@/lib/jobs";

/** جلب الملف الصوتي لمهمة مكتملة */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
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

  return new NextResponse(new Uint8Array(audio.audio), {
    headers: {
      "Content-Type": audio.mimeType,
      "Cache-Control": "private, max-age=1800",
    },
  });
}
