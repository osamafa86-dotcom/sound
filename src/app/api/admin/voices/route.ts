import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { getCustomVoices, getVoiceScores } from "@/lib/admin/stats";
import { catalogs } from "@/lib/admin/health";
import { VOICES } from "@/lib/voices";
import { availableVoices } from "@/lib/providers";

/** كتالوج الأصوات كاملاً + الأصوات المستنسخة/المصممة + ترتيبها بالتقييم */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const available = new Set(availableVoices().map((v) => v.id));
  const [custom, scores] = await Promise.all([getCustomVoices(200), getVoiceScores()]);

  return NextResponse.json({
    summary: catalogs().voices,
    catalog: VOICES.map((v) => ({
      id: v.id,
      name: v.name,
      gender: v.gender,
      dialect: v.dialect,
      provider: v.provider,
      tone: v.tone,
      available: available.has(v.id),
    })),
    custom,
    scores,
  });
}
