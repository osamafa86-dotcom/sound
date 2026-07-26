import { NextRequest, NextResponse } from "next/server";
import { logAdminAction, requireOwner } from "@/lib/owner";
import { getPlatformSettings, savePlatformSettings, type PlatformSettings } from "@/lib/platformSettings";
import { LIMITS } from "@/lib/rateLimit";

/** الإعدادات الحيّة الحالية */
export async function GET(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;
  return NextResponse.json(await getPlatformSettings());
}

/**
 * تعديل الإعدادات الحيّة — مفتاح الصيانة، إيقاف مسارات بعينها،
 * الوضع التجريبي القسري، ولافتة الموقع. تسري خلال ثوانٍ على كل الخوادم.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "الطلب غير صحيح" }, { status: 400 });
  }

  const patch: Partial<PlatformSettings> = {};
  if ("maintenance" in body) patch.maintenance = body.maintenance === true;
  if ("forceMock" in body) patch.forceMock = body.forceMock === true;
  if (typeof body.maintenanceMessage === "string") patch.maintenanceMessage = body.maintenanceMessage.slice(0, 300);
  if (typeof body.banner === "string") patch.banner = body.banner.slice(0, 300);

  if ("disabledRoutes" in body) {
    if (!Array.isArray(body.disabledRoutes)) {
      return NextResponse.json({ error: "قائمة المسارات غير صحيحة" }, { status: 400 });
    }
    const known = Object.keys(LIMITS);
    const unknown = body.disabledRoutes.filter((r: unknown) => typeof r !== "string" || !known.includes(r));
    if (unknown.length) {
      return NextResponse.json({ error: `مسارات غير معروفة: ${unknown.join("، ")}` }, { status: 400 });
    }
    patch.disabledRoutes = body.disabledRoutes;
  }

  try {
    const settings = await savePlatformSettings(patch, guard.user.email);
    await logAdminAction(guard.user, "update_settings", null, patch as Record<string, unknown>);
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "فشل غير متوقع" }, { status: 500 });
  }
}
