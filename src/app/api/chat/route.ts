import { NextRequest, NextResponse } from "next/server";
import {
  appendMessage,
  banByMessage,
  chatSnapshot,
  clearChat,
  deleteMessage,
  heartbeat,
  isBanned,
  unbanAll,
  MAX_TEXT_LEN,
} from "@/lib/chatStore";
import { checkOwnerKey, ownerKeyConfigured } from "@/lib/security";
import { consumeRateLimit, visitorIp } from "@/lib/rateLimit";

/** جلب رسائل الغرفة + عدد المتصلين الحقيقيين */
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

function owner(body: { ownerKey?: string } | null): boolean {
  return ownerKeyConfigured() && checkOwnerKey(String(body?.ownerKey ?? ""));
}

/** إرسال / حضور / حذف / حظر / مسح — الإدارة لصاحب الموقع فقط */
export async function POST(req: NextRequest) {
  const ip = visitorIp(req);
  const body = (await req.json().catch(() => null)) as
    | { action?: string; name?: string; text?: string; ownerKey?: string; id?: number }
    | null;
  const action = String(body?.action ?? "send");

  // نبضة الحضور بالجهاز (IP) — حضور حقيقي
  if (action === "ping") {
    const ok = await consumeRateLimit(`chatping:${ip}`, 60, 60);
    if (!ok) return NextResponse.json({ online: 0 });
    return NextResponse.json({ online: await heartbeat(ip) });
  }

  // ===== إجراءات المالك =====
  if (action === "clear" || action === "delete" || action === "ban" || action === "unban") {
    if (!owner(body)) {
      return NextResponse.json({ error: "غير مصرّح — الإدارة لصاحب الموقع فقط" }, { status: 403 });
    }
    if (action === "clear") {
      await clearChat();
      return NextResponse.json({ ok: true, cleared: true });
    }
    if (action === "unban") {
      await unbanAll();
      return NextResponse.json({ ok: true, unbanned: true });
    }
    const id = Number(body?.id ?? 0);
    if (!id) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    if (action === "delete") {
      const done = await deleteMessage(id);
      return done
        ? NextResponse.json({ ok: true, deleted: id })
        : NextResponse.json({ error: "الرسالة غير موجودة" }, { status: 404 });
    }
    // ban
    const name = await banByMessage(id);
    return name
      ? NextResponse.json({ ok: true, banned: name })
      : NextResponse.json({ error: "تعذّر حظر صاحب هذه الرسالة" }, { status: 404 });
  }

  // ===== إرسال رسالة =====
  const ok = await consumeRateLimit(`chat:${ip}`, 15, 60);
  if (!ok) return NextResponse.json({ error: "تمهّل قليلاً — رسائل كثيرة بسرعة" }, { status: 429 });

  if (await isBanned(ip)) {
    return NextResponse.json({ error: "لا يمكنك الإرسال — تم حظرك من الغرفة" }, { status: 403 });
  }

  const text = String(body?.text ?? "");
  if (!text.trim()) return NextResponse.json({ error: "اكتب رسالة أولاً" }, { status: 400 });
  if (text.length > MAX_TEXT_LEN + 50) {
    return NextResponse.json({ error: "الرسالة طويلة جداً" }, { status: 400 });
  }
  try {
    const msg = await appendMessage(body?.name ?? "", text, ip);
    if (!msg) return NextResponse.json({ error: "رسالة غير صالحة" }, { status: 400 });
    return NextResponse.json({ ok: true, message: msg });
  } catch (e) {
    if (e instanceof Error && e.message === "BANNED") {
      return NextResponse.json({ error: "لا يمكنك الإرسال — تم حظرك من الغرفة" }, { status: 403 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذّر الإرسال" },
      { status: 500 }
    );
  }
}
