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

  // charset صريح: هذه النقطة تُفتح في المتصفح مباشرة للتشخيص، وبدونه
  // تخمّن بعض المتصفحات ترميزاً محلياً فيظهر النص العربي مشوّهاً.
  return new NextResponse(
    JSON.stringify({
      owner,
      enabled,
      // عدد المالكين المضبوطين فقط — بلا أي بريد، ويكشف فوراً هل سرى
      // تعديل المتغير على النشرة الحالية أم أنها ما زالت على القيمة القديمة
      ownerCount: ownerEmails().length,
      signedIn: !!user,
      ...(user && { email: user.email }),
      ...(reason && { reason }),
    }),
    { headers: { "Content-Type": "application/json; charset=utf-8" } }
  );
}
