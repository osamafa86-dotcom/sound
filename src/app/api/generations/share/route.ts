import { NextRequest, NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { newShareId, shareUrl, siteOrigin } from "@/lib/share";

/**
 * تفعيل أو إلغاء المشاركة العامة لعمل واحد.
 *
 * الملكية تفرضها RLS: العميل هنا هو جلسة المستخدم نفسه، فأي محاولة لتعديل
 * صفّ لا يملكه لا تُطابق أي صف ولا تغيّر شيئاً.
 */
export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "المشاركة تحتاج حساباً — المنصة غير مهيأة" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول أولاً" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id: string = typeof body?.id === "string" ? body.id : "";
  const enabled = body?.enabled !== false;
  if (!id) return NextResponse.json({ error: "معرّف العمل مطلوب" }, { status: 400 });

  const { data: row, error: readError } = await supabase
    .from("generations")
    .select("id, share_id")
    .eq("id", id)
    .maybeSingle();

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "العمل غير موجود" }, { status: 404 });

  // المعرّف يُنشأ مرة واحدة ويبقى، فلا ينكسر رابط سبقت مشاركته عند إعادة التفعيل
  const shareId = (row.share_id as string | null) ?? newShareId();

  const { error } = await supabase
    .from("generations")
    .update({ share_id: shareId, is_public: enabled })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    public: enabled,
    shareId,
    url: enabled ? shareUrl(shareId, siteOrigin(req)) : null,
  });
}
