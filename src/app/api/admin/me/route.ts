import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, isOwnerEmail, ownerEmails } from "@/lib/owner";

/**
 * هل الزائر الحالي مالك النظام؟ يستخدمه الشريط العلوي لإظهار رابط اللوحة
 * للمالك وحده. لا يكشف شيئاً عن النظام لغير المالك.
 */
export async function GET(req: NextRequest) {
  const enabled = ownerEmails().length > 0;
  if (!enabled) return NextResponse.json({ owner: false, enabled: false });

  const user = await getRequestUser(req);
  const owner = isOwnerEmail(user?.email);
  return NextResponse.json({
    owner,
    enabled: true,
    ...(owner && { email: user!.email }),
  });
}
