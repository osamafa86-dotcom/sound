import { NextResponse } from "next/server";
import { stripeConfigured } from "@/lib/payments/stripe";
import { coinbaseConfigured } from "@/lib/payments/coinbase";
import { CREDIT_PACKS, PAID_PLANS } from "@/lib/payments/plans";

export const dynamic = "force-dynamic";

/** حالة بوابات الدفع وأسعارها الحية — تقرؤها صفحة الأسعار لعرض الأزرار الصحيحة */
export async function GET() {
  return NextResponse.json({
    stripe: stripeConfigured(),
    crypto: coinbaseConfigured(),
    plans: Object.values(PAID_PLANS).map((p) => ({
      id: p.id,
      usd: p.usd,
      monthlyCredits: p.monthlyCredits,
    })),
    packs: CREDIT_PACKS,
  });
}
