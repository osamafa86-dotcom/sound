import { createHmac, timingSafeEqual } from "crypto";
import type { CreditPack, PaidPlan } from "./plans";

/**
 * Stripe عبر REST مباشرة — بلا SDK ثقيل.
 *
 * Checkout المستضاف لدى Stripe يتكفل بكل شيء: البطاقات وApple Pay
 * وGoogle Pay تلقائياً، وصفحات 3D Secure، والفوترة. نحن ننشئ الجلسة
 * ونستقبل الويب هوك الموقّع فقط — لا بيانات بطاقات تمر بخوادمنا أبداً.
 */

const API = "https://api.stripe.com/v1";

export const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY;

async function stripeCall(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json) {
    const msg = (json?.error as { message?: string } | undefined)?.message ?? `Stripe ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

/** جلسة اشتراك شهري — السعر يُعرَّف ضمنياً فلا يلزم إنشاء منتجات في لوحة Stripe */
export async function createStripeSubscriptionCheckout(
  userId: string,
  plan: PaidPlan,
  origin: string
): Promise<string> {
  const session = await stripeCall("/checkout/sessions", {
    mode: "subscription",
    success_url: `${origin}/pay/success`,
    cancel_url: `${origin}/pricing`,
    client_reference_id: userId,
    "metadata[user_id]": userId,
    "metadata[plan_id]": plan.id,
    "subscription_data[metadata][user_id]": userId,
    "subscription_data[metadata][plan_id]": plan.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(plan.usd * 100)),
    "line_items[0][price_data][recurring][interval]": "month",
    "line_items[0][price_data][product_data][name]": `مقام — باقة ${plan.name}`,
    "line_items[0][price_data][product_data][description]": `${plan.monthlyCredits} نقطة شهرياً`,
  });
  const url = session.url;
  if (typeof url !== "string") throw new Error("لم يُعد Stripe رابط الدفع");
  return url;
}

/** جلسة شراء حزمة نقاط لمرة واحدة */
export async function createStripePackCheckout(
  userId: string,
  pack: CreditPack,
  origin: string
): Promise<string> {
  const session = await stripeCall("/checkout/sessions", {
    mode: "payment",
    success_url: `${origin}/pay/success`,
    cancel_url: `${origin}/pricing`,
    client_reference_id: userId,
    "metadata[user_id]": userId,
    "metadata[pack_id]": pack.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(Math.round(pack.usd * 100)),
    "line_items[0][price_data][product_data][name]": `مقام — ${pack.name}`,
    "line_items[0][price_data][product_data][description]": `${pack.credits} نقطة تُضاف لرصيدك فوراً`,
  });
  const url = session.url;
  if (typeof url !== "string") throw new Error("لم يُعد Stripe رابط الدفع");
  return url;
}

export type StripeEvent = { type: string; data: { object: Record<string, unknown> } };

/**
 * تحقق توقيع الويب هوك: HMAC-SHA256 على `timestamp.body` بسر النقطة،
 * بمقارنة ثابتة الزمن ونافذة 5 دقائق ضد إعادة الإرسال.
 */
export function verifyStripeWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowMs = Date.now()
): StripeEvent | null {
  if (!signatureHeader) return null;

  const parts = new Map(
    signatureHeader.split(",").map((p) => {
      const [k, ...v] = p.split("=");
      return [k.trim(), v.join("=")] as const;
    })
  );
  const timestamp = parts.get("t");
  const signature = parts.get("v1");
  if (!timestamp || !signature) return null;

  if (Math.abs(nowMs / 1000 - Number(timestamp)) > 300) return null;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(rawBody) as StripeEvent;
  } catch {
    return null;
  }
}
