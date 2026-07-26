import { NextResponse } from "next/server";
import { getPlatformSettings } from "@/lib/platformSettings";

/**
 * حالة المنصة للزوار — تقرأها اللافتة أعلى الموقع.
 * عامة عمداً، ولا تكشف إلا ما يخصّ المستخدم: هل هناك صيانة أو إعلان.
 */
export async function GET() {
  const { maintenance, maintenanceMessage, banner, forceMock } = await getPlatformSettings();
  return NextResponse.json(
    { maintenance, maintenanceMessage, banner, demoMode: forceMock },
    { headers: { "Cache-Control": "public, max-age=15" } }
  );
}
