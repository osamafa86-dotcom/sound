import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE,
  GATE_TOKEN_TTL_SEC,
  checkPassword,
  createGateToken,
  readSecurity,
} from "@/lib/security";
import { consumeRateLimit, visitorIp } from "@/lib/rateLimit";

/** دخول بكلمة سر الموقع (الديناميكية من صفحة الحماية) — كوكي جلسة ٣٠ يوماً */
export async function POST(req: NextRequest) {
  const ip = visitorIp(req);
  // تقييد المحاولات: ١٠ كل ١٥ دقيقة لكل IP — يبطئ التخمين الآلي
  const okRate = await consumeRateLimit(`gate:${ip}`, 10, 15 * 60);
  if (!okRate) {
    return NextResponse.json(
      { ok: false, error: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة" },
      { status: 429 }
    );
  }

  const cfg = await readSecurity(true);
  if (!cfg.passwordHash) return NextResponse.json({ ok: true, open: true });

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || !checkPassword(password, cfg)) {
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    return NextResponse.json({ ok: false, error: "كلمة السر غير صحيحة" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, createGateToken(cfg), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_TOKEN_TTL_SEC,
  });
  return res;
}
