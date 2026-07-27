import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getJobsStore } from "@/lib/jobs";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/serverAuth";

/**
 * حفظ خادمي مباشر: ينقل ناتج المهمة من تخزين المهام إلى مكتبة المستخدم
 * (حاوية audio + جدول generations) دون تنزيل ورفع عبر المتصفح.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ jobId: string }> }) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    // المنصة غير مهيأة — العميل يرجع لمسار الحفظ عبر المتصفح
    return NextResponse.json({ error: "الحفظ السحابي غير مفعّل" }, { status: 503 });
  }
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "سجّل الدخول لحفظ أعمالك" }, { status: 401 });
  }

  const { jobId } = await ctx.params;
  const store = getJobsStore();
  const job = await store.get(jobId);
  if (!job || job.status !== "done") {
    return NextResponse.json({ error: "المهمة غير موجودة أو لم تكتمل" }, { status: 404 });
  }
  const audio = await store.getAudio(jobId);
  if (!audio) {
    return NextResponse.json({ error: "تعذّر جلب الملف الصوتي للمهمة" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 200) : null;

  const id = randomUUID();
  const ext = audio.mimeType === "audio/mpeg" ? "mp3" : "wav";
  const path = `${user.id}/song-${id}.${ext}`;

  const upload = await admin.storage.from("audio").upload(path, audio.audio, {
    contentType: audio.mimeType,
  });
  if (upload.error) {
    return NextResponse.json({ error: `تعذّر رفع الملف: ${upload.error.message}` }, { status: 500 });
  }

  const insert = await admin.from("generations").insert({
    id,
    user_id: user.id,
    kind: "song",
    title,
    content: job.request.lyrics ?? null,
    maqam_id: job.request.maqamId,
    style_id: job.request.styleId,
    provider: job.provider ?? null,
    settings: {
      instrumentIds: job.request.instrumentIds,
      tier: job.tier,
      durationSec: job.request.durationSec,
      stylePrompt: job.request.stylePrompt,
      singer: job.request.singer,
      bpm: job.request.bpm,
      sectionsCount: job.request.sections?.length,
    },
    audio_path: path,
    duration_sec: job.request.durationSec ?? null,
  });
  if (insert.error) {
    await admin.storage.from("audio").remove([path]);
    return NextResponse.json({ error: `تعذّر الحفظ: ${insert.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ source: "cloud", id });
}
