import { NextRequest, NextResponse } from "next/server";
import { appendMessage, readChat, MAX_TEXT_LEN } from "@/lib/chatStore";
import { consumeRateLimit, visitorIp } from "@/lib/rateLimit";

/** جلب رسائل الغرفة العامة — منذ معرّف اختياري لتقليل النقل */
export async function GET(req: NextRequest) {
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0);
  const all = await readChat();
  const messages = Number.isFinite(since) && since > 0 ? all.filter((m) => m.id > since) : all;
  return NextResponse.json(
    { messages, lastId: all.length ? all[all.length - 1].id : 0 },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** إرسال رسالة — بتقييد معدّل يمنع الإغراق */
export async function POST(req: NextRequest) {
  const ip = visitorIp(req);
  // ١٥ رسالة كل دقيقة لكل زائر — دردشة مريحة بلا سبام
  const ok = await consumeRateLimit(`chat:${ip}`, 15, 60);
  if (!ok) {
    return NextResponse.json({ error: "تمهّل قليلاً — رسائل كثيرة بسرعة" }, { status: 429 });
  }
  const body = (await req.json().catch(() => null)) as { name?: string; text?: string } | null;
  const text = String(body?.text ?? "");
  if (!text.trim()) return NextResponse.json({ error: "اكتب رسالة أولاً" }, { status: 400 });
  if (text.length > MAX_TEXT_LEN + 50) {
    return NextResponse.json({ error: "الرسالة طويلة جداً" }, { status: 400 });
  }
  try {
    const msg = await appendMessage(body?.name ?? "", text);
    if (!msg) return NextResponse.json({ error: "رسالة غير صالحة" }, { status: 400 });
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذّر الإرسال" },
      { status: 500 }
    );
  }
}
