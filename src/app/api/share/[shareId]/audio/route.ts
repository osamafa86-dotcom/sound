import { NextResponse } from "next/server";
import { getSharedGeneration } from "@/lib/sharedGeneration";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * تشغيل صوت عمل مُشارك. مسار وسيط عمداً بدل رابط تخزين مباشر: مسار الملف
 * يبقى مخفياً، وإلغاء المشاركة يقطع الوصول فوراً بلا انتظار انتهاء رابط موقّع.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ shareId: string }> }) {
  const { shareId } = await ctx.params;

  const generation = await getSharedGeneration(shareId);
  if (!generation?.audioPath) {
    return NextResponse.json({ error: "العمل غير متاح" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin!.storage.from("audio").download(generation.audioPath);
  if (error || !data) {
    return NextResponse.json({ error: "تعذّر تحميل الملف" }, { status: 502 });
  }

  const isWav = generation.audioPath.endsWith(".wav");
  return new NextResponse(data, {
    headers: {
      "Content-Type": isWav ? "audio/wav" : "audio/mpeg",
      "Content-Length": String(data.size),
      // المحتوى ثابت ما دام مُشاركاً، والإلغاء يعيد 404 فوراً من الأصل
      "Cache-Control": "public, max-age=300",
    },
  });
}
