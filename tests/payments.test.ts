import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyStripeWebhook } from "@/lib/payments/stripe";
import { verifyCoinbaseWebhook } from "@/lib/payments/coinbase";
import { CREDIT_PACKS, PAID_PLANS, getPack, getPlan } from "@/lib/payments/plans";

const SECRET = "whsec_test_secret";

function stripeSign(body: string, timestamp: number, secret = SECRET): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

describe("تحقق توقيع Stripe", () => {
  const body = JSON.stringify({ type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
  const now = 1_700_000_000_000;

  it("يقبل توقيعاً صحيحاً ضمن النافذة الزمنية", () => {
    const header = stripeSign(body, now / 1000);
    const event = verifyStripeWebhook(body, header, SECRET, now);
    expect(event?.type).toBe("checkout.session.completed");
  });

  it("يرفض توقيعاً بسر مختلف", () => {
    const header = stripeSign(body, now / 1000, "whsec_wrong");
    expect(verifyStripeWebhook(body, header, SECRET, now)).toBeNull();
  });

  it("يرفض جسماً معدلاً بعد التوقيع", () => {
    const header = stripeSign(body, now / 1000);
    expect(verifyStripeWebhook(body + " ", header, SECRET, now)).toBeNull();
  });

  it("يرفض توقيعاً أقدم من 5 دقائق — ضد إعادة الإرسال", () => {
    const old = now / 1000 - 600;
    const header = stripeSign(body, old);
    expect(verifyStripeWebhook(body, header, SECRET, now)).toBeNull();
  });

  it("يرفض ترويسة غائبة أو مشوهة", () => {
    expect(verifyStripeWebhook(body, null, SECRET, now)).toBeNull();
    expect(verifyStripeWebhook(body, "v1=abc", SECRET, now)).toBeNull();
  });
});

describe("تحقق توقيع Coinbase", () => {
  const body = JSON.stringify({
    event: { type: "charge:confirmed", data: { code: "ABC123", metadata: { user_id: "u1", pack_id: "pack-s" } } },
  });

  it("يقبل توقيع HMAC الصحيح ويعيد الحدث", () => {
    const sig = createHmac("sha256", SECRET).update(body).digest("hex");
    const event = verifyCoinbaseWebhook(body, sig, SECRET);
    expect(event?.type).toBe("charge:confirmed");
    expect(event?.data.metadata?.pack_id).toBe("pack-s");
  });

  it("يرفض توقيعاً خاطئاً أو غائباً", () => {
    expect(verifyCoinbaseWebhook(body, "0".repeat(64), SECRET)).toBeNull();
    expect(verifyCoinbaseWebhook(body, null, SECRET)).toBeNull();
  });
});

describe("الخطط والحزم", () => {
  it("الباقات المدفوعة أعلى من المجانية وتتدرج", () => {
    expect(PAID_PLANS.creator.monthlyCredits).toBeGreaterThan(500);
    expect(PAID_PLANS.studio.monthlyCredits).toBeGreaterThan(PAID_PLANS.creator.monthlyCredits);
    expect(PAID_PLANS.studio.usd).toBeGreaterThan(PAID_PLANS.creator.usd);
  });

  it("سعر النقطة في الحزم الأكبر أرخص — حافز حقيقي للترقية", () => {
    const rates = CREDIT_PACKS.map((p) => p.usd / p.credits);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeLessThan(rates[i - 1]);
  });

  it("الاسترجاع بالمعرّف يعمل ويرفض المجهول", () => {
    expect(getPlan("creator")?.name).toBe("المبدع");
    expect(getPlan("hacker")).toBeNull();
    expect(getPack("pack-m")?.credits).toBe(5000);
    expect(getPack("nope")).toBeNull();
  });
});
