import { NextRequest, NextResponse } from "next/server";
import { SIGNAL_WEIGHTS, recordSignal, type SignalKind } from "@/lib/signals";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";

/** استقبال الإشارات الضمنية — وقود تعلم عقل المنصة */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "signals", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const kind = body?.kind as SignalKind;
  if (!kind || !(kind in SIGNAL_WEIGHTS)) {
    return NextResponse.json({ error: "نوع إشارة غير معروف" }, { status: 400 });
  }

  await recordSignal(
    {
      kind,
      voiceId: typeof body.voiceId === "string" ? body.voiceId.slice(0, 80) : undefined,
      maqamId: typeof body.maqamId === "string" ? body.maqamId.slice(0, 40) : undefined,
      settings:
        body.settings && typeof body.settings === "object"
          ? (body.settings as Record<string, unknown>)
          : undefined,
      meta: body.meta && typeof body.meta === "object" ? (body.meta as Record<string, unknown>) : undefined,
    },
    user?.id ?? null
  );

  return NextResponse.json({ ok: true });
}
