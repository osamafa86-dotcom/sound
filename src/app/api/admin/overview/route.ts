import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { getPlatformSettings } from "@/lib/platformSettings";
import { catalogs, features, integrations, limitsTable, ownerInfo, runtimeInfo } from "@/lib/admin/health";
import { getContentStats, getUsageStats } from "@/lib/admin/stats";

/** الصفحة الأولى للوحة: صحة النظام + أرقام اليوم + حالة كل ميزة */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const settings = await getPlatformSettings();
  const [usage7, usage1, content] = await Promise.all([
    getUsageStats(7),
    getUsageStats(1),
    getContentStats(),
  ]);

  return NextResponse.json({
    viewer: guard.user.email,
    settings,
    runtime: runtimeInfo(),
    owner: ownerInfo(),
    integrations: integrations(),
    features: features(settings.forceMock),
    limits: limitsTable(),
    catalogs: catalogs(),
    usageToday: usage1,
    usageWeek: usage7,
    content,
  });
}
