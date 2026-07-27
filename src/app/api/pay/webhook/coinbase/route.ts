import { NextRequest, NextResponse } from "next/server";
import { verifyCoinbaseWebhook } from "@/lib/payments/coinbase";
import { getPack } from "@/lib/payments/plans";
import { grantPack } from "@/lib/payments/grant";

export const dynamic = "force-dynamic";

/** ويب هوك Coinbase Commerce — المنح بعد تثبيت المعاملة على الشبكة */
export async function POST(req: NextRequest) {
  const secret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "webhook not configured" }, { status: 503 });

  const rawBody = await req.text();
  const event = verifyCoinbaseWebhook(rawBody, req.headers.get("x-cc-webhook-signature"), secret);
  if (!event) return NextResponse.json({ error: "invalid signature" }, { status: 400 });

  // charge:confirmed = المعاملة تأكدت؛ charge:resolved يغطي حالات التأخر
  if (event.type === "charge:confirmed" || event.type === "charge:resolved") {
    const userId = event.data.metadata?.user_id;
    const pack = getPack(event.data.metadata?.pack_id ?? "");
    const ref = event.data.code ?? event.data.id;
    if (userId && pack && ref) {
      await grantPack(userId, "coinbase", pack.id, pack.credits, `cb-${ref}`, pack.usd);
    }
  }

  return NextResponse.json({ received: true });
}
