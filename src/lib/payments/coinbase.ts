import { createHmac, timingSafeEqual } from "crypto";
import type { CreditPack } from "./plans";

/**
 * العملات الرقمية عبر Coinbase Commerce — صفحة دفع مستضافة تقبل
 * BTC وETH وUSDC وغيرها، والتأكيد يصلنا ويب هوك موقّعاً بعد تثبيت
 * المعاملة على الشبكة. (لا اشتراكات متكررة بالعملات الرقمية —
 * تُباع حزم النقاط لمرة واحدة، وهذا أنسب لطبيعتها أصلاً.)
 */

const API = "https://api.commerce.coinbase.com";

export const coinbaseConfigured = () => !!process.env.COINBASE_COMMERCE_API_KEY;

/** إنشاء شحنة بسعر ثابت بالدولار — يعيد رابط صفحة الدفع المستضافة */
export async function createCoinbaseCharge(
  userId: string,
  pack: CreditPack,
  origin: string
): Promise<string> {
  const res = await fetch(`${API}/charges`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CC-Api-Key": process.env.COINBASE_COMMERCE_API_KEY!,
      "X-CC-Version": "2018-03-22",
    },
    body: JSON.stringify({
      name: `مقام — ${pack.name}`,
      description: `${pack.credits} نقطة تُضاف لرصيدك بعد تأكيد المعاملة`,
      pricing_type: "fixed_price",
      local_price: { amount: pack.usd.toFixed(2), currency: "USD" },
      metadata: { user_id: userId, pack_id: pack.id },
      redirect_url: `${origin}/pay/success?provider=crypto`,
      cancel_url: `${origin}/pricing`,
    }),
  });

  const json = (await res.json().catch(() => null)) as {
    data?: { hosted_url?: string };
    error?: { message?: string };
  } | null;

  if (!res.ok || !json?.data?.hosted_url) {
    throw new Error(json?.error?.message ?? `Coinbase ${res.status}`);
  }
  return json.data.hosted_url;
}

export type CoinbaseEvent = {
  type: string;
  data: { id?: string; code?: string; metadata?: { user_id?: string; pack_id?: string } };
};

/** تحقق توقيع الويب هوك: HMAC-SHA256 على الجسم الخام بمقارنة ثابتة الزمن */
export function verifyCoinbaseWebhook(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): CoinbaseEvent | null {
  if (!signatureHeader) return null;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader.trim());
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(rawBody) as { event?: CoinbaseEvent };
    return parsed.event ?? null;
  } catch {
    return null;
  }
}
