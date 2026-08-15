import { NextRequest, NextResponse } from "next/server";
import { appendMessage, chatSnapshot, clearChat, heartbeat, readChat, MAX_TEXT_LEN } from "@/lib/chatStore";
import { checkOwnerKey, ownerKeyConfigured } from "@/lib/security";
import { consumeRateLimit, visitorIp } from "@/lib/rateLimit";

/** جلب رسائل الغرفة + عدد المتصلين — منذ معرّف اختياري لتقليل النقل */
export async function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0);
  const snap = await chatSnapshot();
  const messages =
    Number.isFinite(since) && since > 0 ? snap.messages.filter((m) => m.id > since) : snap.messages;
  const lastId = snap.messages.length ? snap.messages[snap.messages.length - 1].id : 0;
  return NextResponse.json(
    { messages, lastId, online: snap.online },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** إرسال رسالة / نبضة حضور / مسح الغرفة (للمالك) */
export async function POST(req: NextRequest) {
  const ip = visitorIp(req);
  const body = (await req.json().catch(() => null)) as
    | { action?: string; name?: string; text?: string; ownerKey?: string }
    | null;
  const action = String(body?.action ?? "send");

  // نبضة الحضور: خفيفة جداً، حد سخي
  if (action === "ping") {
    const ok = await consumeRateLimit(`chatping:${ip}`, 60, 60);
    if (!ok) return NextResponse.json({ online: 0 });
    const online = await heartbeat(body?.name ?? "زائر");
    return NextResponse.json({ online });
  }

  // مسح الغرفة — لصاحب الموقع فقط
  if (action === "clear") {
    if (!ownerKeyConfigured() || !checkOwnerKey(String(body?.ownerKey ?? ""))) {
      return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
    }
    await clearChat();
    return NextResponse.json({ ok: true, cleared: true });
  }

  // إرسال رسالة — تقييد ضد الإغراق
  const ok = await consumeRateLimit(`chat:${ip}`, 15, 60);
  if (!ok) return NextResponse.json({ error: "تمهّل قليلاً — رسائل كثيرة بسرعة" }, { status: 429 });

  const text = String(body?.text ?? "");
  if (!text.trim()) return NextResponse.json({ error: "اكتب رسالة أولاً" }, { status: 400 });
  if (text.length > MAX_TEXT_LEN + 50) {
    return NextResponse.json({ error: "الرسالة طويلة جداً" }, { status: 400 });
  }
  try {
    const msg = await appendMessage(body?.name ?? "", text);
    if (!msg) return NextResponse.json({ error: "رسالة غير صالحة" }, { status: 400 });
    void readChat; // (مُبقاة للتوافق)
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذّر الإرسال" },
      { status: 500 }
    );
  }
}
