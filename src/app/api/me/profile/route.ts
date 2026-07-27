import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getTasteProfile } from "@/lib/profile";

/** ملف الذوق المتعلم للمستخدم — افتراضات شخصية في الاستوديوهات */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ profile: null });

  const profile = await getTasteProfile(user.id);
  return NextResponse.json({ profile });
}
