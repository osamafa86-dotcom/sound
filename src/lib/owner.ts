import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { createClient } from "./supabase/server";

/**
 * صلاحية «مالك النظام» — أعلى مستوى وصول في المنصة.
 *
 * المالك يُعرّف ببريده في متغير البيئة OWNER_EMAILS (مفصولة بفواصل).
 * القاعدة الافتراضية آمنة: بلا ضبط للمتغير لا يوجد مالك إطلاقاً، فلا تُفتح
 * اللوحة لأحد بالخطأ عند نسيان الإعداد.
 */

/** قائمة بُرُد المالكين كما ضُبطت في البيئة (بحروف صغيرة وبلا فراغات) */
export function ownerEmails(): string[] {
  return (process.env.OWNER_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** هل هذا البريد لمالك النظام؟ */
export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.trim().toLowerCase());
}

export type OwnerUser = { id: string; email: string };

/**
 * هوية الطالب من الجلسة (كوكيز المتصفح) أو من ترويسة Bearer.
 * اللوحة تعمل بالكوكيز، والـ Bearer متاح لأدوات المالك الخارجية.
 */
export async function getRequestUser(req: NextRequest): Promise<OwnerUser | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    const admin = getSupabaseAdmin();
    if (admin) {
      const { data } = await admin.auth.getUser(token);
      if (data.user?.email) return { id: data.user.id, email: data.user.email };
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return null;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email) return null;
  return { id: data.user.id, email: data.user.email };
}

export type OwnerGuard =
  | { ok: true; user: OwnerUser }
  | { ok: false; response: NextResponse };

/**
 * حارس مسارات اللوحة — يعيد المستخدم إن كان مالكاً، أو الاستجابة المناسبة.
 * الاستعمال: `const guard = await requireOwner(req); if (!guard.ok) return guard.response;`
 */
export async function requireOwner(req: NextRequest): Promise<OwnerGuard> {
  if (ownerEmails().length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "لوحة المالك غير مفعّلة — اضبط متغير OWNER_EMAILS في بيئة الخادم" },
        { status: 503 }
      ),
    };
  }

  const user = await getRequestUser(req);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "سجّل الدخول أولاً" }, { status: 401 }),
    };
  }
  if (!isOwnerEmail(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "هذه الصفحة لمالك النظام فقط" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

/**
 * سجل تدقيق لكل إجراء إداري (تغيير رصيد، إيقاف مسار، حذف صوت...).
 * لا يعطّل الإجراء أبداً إذا فشل التسجيل — يكتفي بتحذير في السجلات.
 */
export async function logAdminAction(
  actor: OwnerUser,
  action: string,
  target: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.from("admin_audit").insert({
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    target,
    details,
  });
  if (error) console.error("admin audit failed:", error.message);
}
