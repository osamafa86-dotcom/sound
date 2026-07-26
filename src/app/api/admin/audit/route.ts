import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { getAuditLog } from "@/lib/admin/stats";

/** سجل الإجراءات الإدارية — من فعل ماذا ومتى */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const limit = Number(req.nextUrl.searchParams.get("limit")) || 50;
  return NextResponse.json(await getAuditLog(limit));
}
