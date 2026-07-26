import { NextRequest, NextResponse } from "next/server";
import { logAdminAction, requireOwner } from "@/lib/owner";
import { getLimitWindows, resetLimitWindow } from "@/lib/admin/stats";
import { limitsTable } from "@/lib/admin/health";

/** النوافذ المستهلكة الآن مقابل الحدود المضبوطة */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  return NextResponse.json({ rules: limitsTable(), ...(await getLimitWindows()) });
}

/** تصفير نافذة حد — لفك حظر مستخدم أو رفع السقف العام فوراً */
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  if (!key) return NextResponse.json({ error: "المفتاح مطلوب" }, { status: 400 });

  try {
    await resetLimitWindow(key);
    await logAdminAction(guard.user, "reset_limit", key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل غير متوقع" }, { status: 500 });
  }
}
