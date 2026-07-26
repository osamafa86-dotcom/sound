import { NextRequest, NextResponse } from "next/server";
import { isOwnerEmail, logAdminAction, requireOwner } from "@/lib/owner";
import { getUsers, setUserCredits } from "@/lib/admin/stats";

/** قائمة المستخدمين مع رصيدهم ونشاطهم */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const params = req.nextUrl.searchParams;
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const perPage = Number(params.get("perPage")) || 50;

  const result = await getUsers(page, perPage, isOwnerEmail);
  return NextResponse.json(result);
}

/** تعديل رصيد كريدت مستخدم */
export async function PATCH(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const credits = Number(body?.credits);

  if (!userId) return NextResponse.json({ error: "معرّف المستخدم مطلوب" }, { status: 400 });
  if (!Number.isFinite(credits) || credits < 0 || credits > 1_000_000) {
    return NextResponse.json({ error: "قيمة الرصيد غير صحيحة (0 إلى مليون)" }, { status: 400 });
  }

  try {
    await setUserCredits(userId, Math.floor(credits));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل غير متوقع" }, { status: 500 });
  }

  await logAdminAction(guard.user, "set_credits", userId, { credits: Math.floor(credits) });
  return NextResponse.json({ ok: true, credits: Math.floor(credits) });
}
