import { NextRequest, NextResponse } from "next/server";
import { checkGatePassword, createGateToken, GATE_COOKIE, GATE_TOKEN_TTL_SEC } from "@/lib/siteGate";
import { consumeRateLimit, visitorIp } from "@/lib/rateLimit";

/** بوابة كلمة سر الموقع: كلمة سر واحدة مشتركة، لا صلة لها بحسابات Supabase */
export async function POST(req: NextRequest) {
  const ip = visitorIp(req);
  // تقييد المحاولات: ١٠ كل ١٥ دقيقة لكل IP — يبطئ التخمين الآلي بلا إزعاج المستخدم الحقيقي
  const okRate = await consumeRateLimit(`gate:${ip}`, 10, 15 * 60);
  if (!okRate) {
    return NextResponse.json(
      { ok: false, error: "محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة" },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkGatePassword(password)) {
    // إبطاء خفيف ضد قياس التوقيت وهجمات القوة الغاشمة الآلية
    await new Promise((r) => setTimeout(r, 300 + Math.random() * 300));
    return NextResponse.json({ ok: false, error: "كلمة السر غير صحيحة" }, { status: 401 });
  }

  const token = await createGateToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_TOKEN_TTL_SEC,
  });
  return res;
}
