import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { getContentStats, getUsageStats, getVoiceScores } from "@/lib/admin/stats";

/** تفصيل الاستهلاك والمخرجات لمدة يختارها المالك (؟days=30) */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const raw = Number(req.nextUrl.searchParams.get("days"));
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 90) : 30;

  const [usage, content, voiceScores] = await Promise.all([
    getUsageStats(days),
    getContentStats(),
    getVoiceScores(),
  ]);

  return NextResponse.json({ usage, content, voiceScores });
}
