import { NextRequest, NextResponse } from "next/server";
import { logAdminAction, requireOwner } from "@/lib/owner";
import { getJobs, purgeJobs } from "@/lib/admin/stats";

/** مهام توليد الأغاني — الحالة والمرحلة وسبب الفشل */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  const status = params.get("status") ?? undefined;
  const limit = Number(params.get("limit")) || 50;

  const valid = ["pending", "running", "done", "failed"];
  if (status && !valid.includes(status)) {
    return NextResponse.json({ error: "حالة غير معروفة" }, { status: 400 });
  }

  return NextResponse.json(await getJobs(limit, status));
}

/** تنظيف المهام القديمة (؟days=1) */
export async function DELETE(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const raw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 365) : 1;

  try {
    const deleted = await purgeJobs(days);
    await logAdminAction(guard.user, "purge_jobs", null, { days, deleted });
    return NextResponse.json({ ok: true, deleted });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل غير متوقع" }, { status: 500 });
  }
}
