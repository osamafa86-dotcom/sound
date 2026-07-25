import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * التحقق الخادمي من هوية المستخدم عبر ترويسة Authorization: Bearer
 * التي يرسلها العميل من جلسة Supabase. يعيد null لغير المسجلين
 * أو عندما تكون المنصة غير مهيأة.
 */
export async function getUserFromRequest(req: NextRequest): Promise<{ id: string } | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id };
}

/** عنوان IP للطالب — Vercel يمرره في x-forwarded-for */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
