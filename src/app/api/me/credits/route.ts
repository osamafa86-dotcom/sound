import { NextRequest, NextResponse } from "next/server";
import { CREDIT_COSTS, FREE_MONTHLY_CREDITS, getCreditProfile } from "@/lib/credits";
import { getUserFromRequest } from "@/lib/serverAuth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** رصيد المستخدم الحالي مع جدول التكاليف — للمكتبة وصفحة الأسعار */
export async function GET(req: NextRequest) {
  // جلسة الكوكيز أولاً ثم ترويسة التوثيق — نفس ازدواجية بقية المسارات
  const supabase = await createClient();
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  const user = cookieUser ?? (await getUserFromRequest(req));

  if (!user) {
    return NextResponse.json({
      signedIn: false,
      monthly: FREE_MONTHLY_CREDITS,
      costs: CREDIT_COSTS,
    });
  }

  const profile = await getCreditProfile(user.id);
  return NextResponse.json({
    signedIn: true,
    balance: profile?.balance ?? null,
    // الباقة الفعلية للمستخدم — المشترك المدفوع يرى حده الحقيقي لا المجاني
    plan: profile?.plan ?? "free",
    monthly: profile?.monthly ?? FREE_MONTHLY_CREDITS,
    costs: CREDIT_COSTS,
  });
}
