import { NextRequest, NextResponse } from "next/server";
import { verifyStripeWebhook } from "@/lib/payments/stripe";
import { getPack, getPlan } from "@/lib/payments/plans";
import {
  findUserBySubscription,
  grantPack,
  grantRenewal,
  grantSubscription,
  revokeSubscription,
} from "@/lib/payments/grant";

export const dynamic = "force-dynamic";

/**
 * ويب هوك Stripe — التوقيع أولاً ثم المنح الذري:
 * checkout.session.completed (اشتراك جديد أو حزمة)،
 * invoice.paid (تجديد شهري)، customer.subscription.deleted (إلغاء).
 */
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  const rawBody = await req.text();
  const event = verifyStripeWebhook(rawBody, req.headers.get("stripe-signature"), secret);
  if (!event) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  const obj = event.data.object;

  if (event.type === "checkout.session.completed") {
    const meta = (obj.metadata ?? {}) as { user_id?: string; plan_id?: string; pack_id?: string };
    const userId = meta.user_id ?? (obj.client_reference_id as string | undefined);
    const sessionId = obj.id as string;
    const amountUsd = typeof obj.amount_total === "number" ? obj.amount_total / 100 : null;
    if (!userId) return NextResponse.json({ received: true });

    if (obj.mode === "subscription" && meta.plan_id) {
      const plan = getPlan(meta.plan_id);
      if (plan) {
        await grantSubscription(userId, plan.id, sessionId, amountUsd, {
          customerId: typeof obj.customer === "string" ? obj.customer : undefined,
          subscriptionId: typeof obj.subscription === "string" ? obj.subscription : undefined,
        });
      }
    } else if (obj.mode === "payment" && meta.pack_id) {
      const pack = getPack(meta.pack_id);
      if (pack) await grantPack(userId, "stripe", pack.id, pack.credits, sessionId, amountUsd);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "invoice.paid") {
    // التجديد الدوري فقط — فاتورة الإنشاء الأولى غطّتها جلسة الإتمام أعلاه
    if (obj.billing_reason !== "subscription_cycle") return NextResponse.json({ received: true });
    const subId =
      typeof obj.subscription === "string"
        ? obj.subscription
        : ((obj.parent as { subscription_details?: { subscription?: string } } | undefined)
            ?.subscription_details?.subscription ?? null);
    if (!subId) return NextResponse.json({ received: true });

    const userId = await findUserBySubscription(subId);
    if (userId) {
      const admin = await import("@/lib/supabaseAdmin").then((m) => m.getSupabaseAdmin());
      const { data } = (await admin?.from("profiles").select("plan").eq("id", userId).single()) ?? {};
      const plan = getPlan(data?.plan ?? "");
      const amountUsd = typeof obj.amount_paid === "number" ? obj.amount_paid / 100 : null;
      if (plan) await grantRenewal(userId, plan.id, obj.id as string, amountUsd);
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const subId = obj.id as string;
    if (subId) await revokeSubscription(subId);
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
