import { NextRequest, NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { facebookConfigured } from "@/lib/facebook/config";
import { listPages, removePage } from "@/lib/facebook/pages";

/** صفحات المستخدم المربوطة — بلا أي رمز وصول في الجواب */
export async function GET() {
  if (!facebookConfigured() || !supabaseConfigured()) {
    return NextResponse.json({ configured: false, pages: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ configured: true, pages: [] });

  return NextResponse.json({ configured: true, pages: await listPages(user.id) });
}

/** فكّ ربط صفحة — يحذف رمزها من عندنا */
export async function DELETE(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "معرّف الصفحة مطلوب" }, { status: 400 });

  await removePage(user.id, pageId);
  return NextResponse.json({ ok: true });
}
