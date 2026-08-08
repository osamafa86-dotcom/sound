import { NextRequest, NextResponse } from "next/server";
import { whatsappConfig } from "@/lib/whatsapp/config";
import { extractMessages, verifySignature } from "@/lib/whatsapp/verify";
import { saveMessage } from "@/lib/whatsapp/store";

/**
 * نقطة استقبال واتساب.
 *
 * GET  — تحقق Meta من ملكية المسار مرة واحدة عند الربط.
 * POST — كل رسالة يكتبها زبون تصل هنا خلال ثانية.
 *
 * مهم: Meta تعيد الإرسال إن لم تتلقَّ 200 سريعاً، فنردّ دائماً بـ 200 بعد
 * الحفظ ولا نُفشل الطلب على خطأ داخلي — وإلا تكرّرت الرسائل بلا نهاية.
 */

/** يجب أن يبقى على Node: التحقق من التوقيع يستخدم node:crypto */
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const cfg = whatsappConfig();
  if (!cfg) return new NextResponse("غير مفعّل", { status: 503 });

  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  // Meta تتوقع نصّ التحدي وحده في الجسم — لا JSON ولا أي زيادة
  if (mode === "subscribe" && token === cfg.verifyToken && challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("رفض التحقق", { status: 403 });
}

export async function POST(req: NextRequest) {
  const cfg = whatsappConfig();
  if (!cfg) return new NextResponse("غير مفعّل", { status: 503 });

  // النص الخام أولاً: التوقيع يُحسب عليه، وإعادة ترميز JSON تُبطله
  const raw = await req.text();

  if (cfg.appSecret) {
    const ok = verifySignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret);
    if (!ok) {
      console.warn("whatsapp webhook: توقيع غير صالح — رُفضت الحمولة");
      return new NextResponse("توقيع غير صالح", { status: 401 });
    }
  } else {
    // بلا سرّ التطبيق يستطيع أي أحد حقن رسالة مزوّرة — نعمل وننبّه
    console.warn("whatsapp webhook: لا WHATSAPP_APP_SECRET — الحمولات غير موثّقة");
  }

  try {
    const payload = JSON.parse(raw);
    for (const m of extractMessages(payload)) {
      await saveMessage({
        waId: m.waId,
        contact: m.from,
        name: m.name,
        direction: "in",
        type: m.type,
        text: m.text,
        mediaId: m.mediaId,
        createdAt: new Date(Number(m.timestamp) * 1000).toISOString(),
      });
    }
  } catch (e) {
    // نبتلع الخطأ عمداً: 500 تجعل Meta تعيد الإرسال بلا طائل
    console.error("whatsapp webhook failed:", e);
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
