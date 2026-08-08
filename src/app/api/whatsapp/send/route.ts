import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/owner";
import { whatsappConfig } from "@/lib/whatsapp/config";
import { sendText } from "@/lib/whatsapp/send";
import { saveMessage } from "@/lib/whatsapp/store";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { logUsage } from "@/lib/usage";

/** الردّ على زبون من الصندوق */
export async function POST(req: NextRequest) {
  const guard = await requireOwner(req);
  if (!guard.ok) return guard.response;

  const cfg = whatsappConfig();
  if (!cfg) {
    return NextResponse.json({ error: "واتساب غير مفعّل على هذا الخادم" }, { status: 503 });
  }

  const verdict = await checkLimit(req, "whatsapp", guard.user.id);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const to: string = typeof body?.to === "string" ? body.to.trim() : "";
  const text: string = typeof body?.text === "string" ? body.text.trim().slice(0, 4000) : "";
  if (!to || !text) {
    return NextResponse.json({ error: "الرقم والنص مطلوبان" }, { status: 400 });
  }

  try {
    const { waId } = await sendText(cfg, to, text);
    // نحفظ نسختنا فوراً: الرسائل الصادرة لا تعود إلينا عبر الـ webhook
    await saveMessage({
      waId,
      contact: to.replace(/[^0-9]/g, ""),
      name: null,
      direction: "out",
      type: "text",
      text,
      mediaId: null,
      createdAt: new Date().toISOString(),
    });
    await logUsage("whatsapp", guard.user.id).catch(() => {});
    return NextResponse.json({ waId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذّر الإرسال" },
      { status: 502 }
    );
  }
}
