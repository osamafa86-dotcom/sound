import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getUsageSummary } from "@/lib/usage";

/** ملخص استهلاك المستخدم لآخر ٣٠ يوماً — يظهر في مكتبته */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "سجّل الدخول أولاً" }, { status: 401 });
  }
  const summary = await getUsageSummary(user.id);
  return NextResponse.json(summary);
}
