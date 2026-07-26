import { NextRequest, NextResponse } from "next/server";
import { getRequestUser, isOwnerEmail, ownerEmails } from "@/lib/owner";

/**
 * هل الزائر الحالي مالك النظام؟ يستخدمه الشريط العلوي لإظهار رابط اللوحة
 * للمالك وحده.
 *
 * يعيد أيضاً تشخيصاً صريحاً لسبب الرفض: بريد صاحب الجلسة نفسه (يراه هو
 * وحده) وحالة تسجيل دخوله — فيميّز «لست مسجّلاً» عن «بريدك ليس مالكاً»
 * دون كشف قائمة المالكين لأحد.
 */
export async function GET(req: NextRequest) {
  const enabled = ownerEmails().length > 0;
  const user = await getRequestUser(req);
  const owner = isOwnerEmail(user?.email);

  const reason = owner
    ? undefined
    : !enabled
      ? "لم يُضبط متغير OWNER_EMAILS في بيئة الخادم"
      : !user
        ? "لست مسجّل الدخول في هذا المتصفح"
        : "بريدك المسجّل ليس ضمن OWNER_EMAILS";

  return NextResponse.json({
    owner,
    enabled,
    signedIn: !!user,
    ...(user && { email: user.email }),
    ...(reason && { reason }),
  });
}
