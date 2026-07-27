import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** الروابط الموقعة تتجدد مع كل طلب — لا تخزين مؤقت للصفحة */
export const dynamic = "force-dynamic";

/**
 * المعرض العام — الأعمال التي نشرها أصحابها باختيارهم.
 * يقرأ بمفتاح الخدمة (الملفات في مخزن خاص) ويعيد روابط استماع موقتة.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ items: [] });

  const { data, error } = await admin
    .from("generations")
    .select("id, kind, title, content, voice_id, maqam_id, style_id, provider, audio_path, created_at")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(30);

  // قاعدة لم تُحدَّث بعمود المعرض — معرض فارغ أفضل من صفحة مكسورة
  if (error) {
    if (!/is_public/.test(error.message)) console.error("Gallery query failed:", error.message);
    return NextResponse.json({ items: [] });
  }

  const items = await Promise.all(
    (data ?? []).map(async (g) => {
      if (!g.audio_path) return { ...g, url: null };
      const { data: signed } = await admin.storage
        .from("audio")
        .createSignedUrl(g.audio_path, 60 * 60);
      return { ...g, url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ items: items.filter((i) => i.url) });
}
