import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { logAdminAction, requireOwner } from "@/lib/owner";

/** تذاكر الدعم للمالك — الأحدث أولاً والمفتوحة قبل المغلقة */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ tickets: [] });

  const { data, error } = await admin
    .from("support_tickets")
    .select("id, email, topic, message, status, reply, created_at, user_id")
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    // قاعدة لم تُرحَّل بعد — قائمة فارغة مع تلميح بدل انهيار اللوحة
    const needsMigration = /support_tickets/.test(error.message);
    return NextResponse.json(needsMigration ? { tickets: [], needsMigration: true } : { tickets: [] });
  }
  return NextResponse.json({ tickets: data ?? [] });
}

/** إغلاق تذكرة أو إعادة فتحها مع رد اختياري يُحفظ في سجلها */
export async function PATCH(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const status = body?.status === "closed" ? "closed" : "open";
  const reply = typeof body?.reply === "string" ? body.reply.trim().slice(0, 4000) : undefined;

  if (!id) return NextResponse.json({ error: "معرّف التذكرة مطلوب" }, { status: 400 });

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "غير مهيأ" }, { status: 503 });

  const { error } = await admin
    .from("support_tickets")
    .update({ status, ...(reply !== undefined && { reply }) })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(guard.user, "support_ticket", id, { status, replied: !!reply });
  return NextResponse.json({ ok: true });
}
