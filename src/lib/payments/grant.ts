import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { PAID_PLANS, type PaidPlanId } from "./plans";

/**
 * تطبيق أثر الدفع على الحساب — نقطة الحقيقة الوحيدة بعد التحقق من التوقيع.
 *
 * الحماية من التكرار في القاعدة نفسها: مرجع العملية لدى المزود فريد،
 * فإعادة إرسال الويب هوك (يفعلها كل المزودين) لا تضيف الرصيد مرتين.
 */

type GrantResult = "granted" | "duplicate" | "failed";

async function recordPayment(args: {
  userId: string;
  provider: "stripe" | "coinbase";
  kind: "subscription" | "renewal" | "pack";
  planId: string | null;
  creditsGranted: number;
  amountUsd: number | null;
  providerRef: string;
}): Promise<GrantResult> {
  const admin = getSupabaseAdmin();
  if (!admin) return "failed";

  const { error } = await admin.from("payments").insert({
    user_id: args.userId,
    provider: args.provider,
    kind: args.kind,
    plan_id: args.planId,
    credits_granted: args.creditsGranted,
    amount_usd: args.amountUsd,
    provider_ref: args.providerRef,
  });

  if (error) {
    // مرجع مكرر = ويب هوك معاد — نجاح صامت بلا منح جديد
    if (/duplicate|unique/i.test(error.message)) return "duplicate";
    console.error("recordPayment failed:", error.message);
    return "failed";
  }
  return "granted";
}

/** اشتراك جديد: رفع الباقة وتعبئة الرصيد لحدها فوراً وربط معرّف الاشتراك */
export async function grantSubscription(
  userId: string,
  planId: PaidPlanId,
  providerRef: string,
  amountUsd: number | null,
  stripeIds?: { customerId?: string; subscriptionId?: string }
): Promise<GrantResult> {
  const plan = PAID_PLANS[planId];
  const recorded = await recordPayment({
    userId,
    provider: "stripe",
    kind: "subscription",
    planId,
    creditsGranted: plan.monthlyCredits,
    amountUsd,
    providerRef,
  });
  if (recorded !== "granted") return recorded;

  const admin = getSupabaseAdmin()!;
  const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
  const { error } = await admin
    .from("profiles")
    .update({
      plan: planId,
      monthly_credits: plan.monthlyCredits,
      credits: Math.max(profile?.credits ?? 0, plan.monthlyCredits),
      ...(stripeIds?.customerId && { stripe_customer_id: stripeIds.customerId }),
      ...(stripeIds?.subscriptionId && { stripe_subscription_id: stripeIds.subscriptionId }),
    })
    .eq("id", userId);
  if (error) console.error("grantSubscription profile update failed:", error.message);
  return "granted";
}

/** تجديد شهري: تعبئة الرصيد لحد الباقة (لا يمس رصيداً أعلى من حزم إضافية) */
export async function grantRenewal(
  userId: string,
  planId: PaidPlanId,
  providerRef: string,
  amountUsd: number | null
): Promise<GrantResult> {
  const plan = PAID_PLANS[planId];
  const recorded = await recordPayment({
    userId,
    provider: "stripe",
    kind: "renewal",
    planId,
    creditsGranted: plan.monthlyCredits,
    amountUsd,
    providerRef,
  });
  if (recorded !== "granted") return recorded;

  const admin = getSupabaseAdmin()!;
  const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
  await admin
    .from("profiles")
    .update({ credits: Math.max(profile?.credits ?? 0, plan.monthlyCredits) })
    .eq("id", userId);
  return "granted";
}

/** حزمة نقاط: إضافة فورية فوق الرصيد الحالي أياً كان */
export async function grantPack(
  userId: string,
  provider: "stripe" | "coinbase",
  packId: string,
  credits: number,
  providerRef: string,
  amountUsd: number | null
): Promise<GrantResult> {
  const recorded = await recordPayment({
    userId,
    provider,
    kind: "pack",
    planId: packId,
    creditsGranted: credits,
    amountUsd,
    providerRef,
  });
  if (recorded !== "granted") return recorded;

  const admin = getSupabaseAdmin()!;
  const { data: profile } = await admin.from("profiles").select("credits").eq("id", userId).single();
  await admin
    .from("profiles")
    .update({ credits: (profile?.credits ?? 0) + credits })
    .eq("id", userId);
  return "granted";
}

/** إلغاء الاشتراك: عودة للباقة المجانية مع إبقاء الرصيد المتبقي كما هو */
export async function revokeSubscription(stripeSubscriptionId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  await admin
    .from("profiles")
    .update({ plan: "free", monthly_credits: 500, stripe_subscription_id: null })
    .eq("stripe_subscription_id", stripeSubscriptionId);
}

/** إيجاد صاحب اشتراك — للتجديدات التي لا تحمل metadata المستخدم */
export async function findUserBySubscription(stripeSubscriptionId: string): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .single();
  return data?.id ?? null;
}
