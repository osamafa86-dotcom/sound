import { NextResponse } from "next/server";

/**
 * المدفوعات معطلة نهائياً — الموقع نسخة خاصة مجانية خلف كلمة سر الدخول،
 * بلا حسابات ولا اشتراكات. (كود الدفع الكامل محفوظ في تاريخ Git لإعادته لاحقاً.)
 */
export async function POST() {
  return NextResponse.json(
    { error: "المدفوعات معطلة — الموقع مجاني خلف كلمة سر الدخول" },
    { status: 503 }
  );
}
