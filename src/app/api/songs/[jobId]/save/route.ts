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
    // المنصة غير مهيأة — العميل يرجع لمسار الحفظ المحلي
    return NextResponse.json({ error: "الحفظ السحابي غير مفعّل" }, { status: 503 });
  }
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "سجّل الدخول للحفظ في مكتبتك السحابية" }, { status: 401 });
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
  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim().slice(0, 120) : "أغنية";
  const details = typeof body?.details === "string" ? body.details.trim().slice(0, 300) : "";

  const id = randomUUID();
  const ext = audio.mimeType === "audio/mpeg" ? "mp3" : "wav";
  const path = `${user.id}/${id}.${ext}`;

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
    details,
    mime_type: audio.mimeType,
    storage_path: path,
  });
  if (insert.error) {
    await admin.storage.from("audio").remove([path]);
    return NextResponse.json({ error: `تعذّر الحفظ: ${insert.error.message}` }, { status: 500 });
  }

  return NextResponse.json({ source: "cloud", id });
}
