import { NextRequest, NextResponse } from "next/server";
import {
  createStripePackCheckout,
  createStripeSubscriptionCheckout,
  stripeConfigured,
} from "@/lib/payments/stripe";
import { coinbaseConfigured, createCoinbaseCharge } from "@/lib/payments/coinbase";
import { getPack, getPlan } from "@/lib/payments/plans";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { createClient } from "@/lib/supabase/server";

/** إنشاء جلسة دفع — اشتراك عبر Stripe أو حزمة نقاط عبر Stripe/العملات الرقمية */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user: cookieUser },
  } = await supabase.auth.getUser();
  const user = cookieUser ?? (await getUserFromRequest(req));
  if (!user) {
    return NextResponse.json({ error: "سجّل الدخول أولاً — الرصيد يُضاف لحسابك" }, { status: 401 });
  }

  const verdict = await checkLimit(req, "pay", user.id);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const type = body?.type === "plan" ? "plan" : "pack";
  const provider = body?.provider === "coinbase" ? "coinbase" : "stripe";
  const id = typeof body?.id === "string" ? body.id : "";

  // مصدر الروابط العائدة — نطاق الطلب نفسه فلا يلزم ضبط يدوي
  const origin = req.nextUrl.origin;

  try {
    if (type === "plan") {
      const plan = getPlan(id);
      if (!plan) return NextResponse.json({ error: "باقة غير معروفة" }, { status: 400 });
      if (!stripeConfigured()) {
        return NextResponse.json(
          { error: "الاشتراكات لم تُفعَّل بعد — راسل الدعم للترقية اليدوية" },
          { status: 503 }
        );
      }
      const url = await createStripeSubscriptionCheckout(user.id, plan, origin);
      return NextResponse.json({ url });
    }

    const pack = getPack(id);
    if (!pack) return NextResponse.json({ error: "حزمة غير معروفة" }, { status: 400 });

    if (provider === "coinbase") {
      if (!coinbaseConfigured()) {
        return NextResponse.json(
          { error: "الدفع بالعملات الرقمية لم يُفعَّل بعد" },
          { status: 503 }
        );
      }
      const url = await createCoinbaseCharge(user.id, pack, origin);
      return NextResponse.json({ url });
    }

    if (!stripeConfigured()) {
      return NextResponse.json({ error: "الدفع بالبطاقات لم يُفعَّل بعد" }, { status: 503 });
    }
    const url = await createStripePackCheckout(user.id, pack, origin);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("Checkout failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "تعذّر إنشاء جلسة الدفع — حاول مجدداً" }, { status: 502 });
  }
}
