import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE,
  GATE_TOKEN_TTL_SEC,
  checkPassword,
  createGateToken,
  hashPassword,
  newSalt,
  readSecurity,
  writeSecurity,
} from "@/lib/security";
import { bustEdgeSecurityCache } from "@/lib/securityEdge";
import { consumeRateLimit, visitorIp } from "@/lib/rateLimit";

/**
 * إدارة حماية الموقع من صفحة /security:
 * كلمة السر: إضافة / تغيير / إزالة — بلا أي نشر.
 * القاعدة: الموقع المفتوح يضبط حمايته أول مرة بحرية؛ وأي تعديل بعدها
 * يتطلب كلمة السر الحالية نصاً.
 */

function setGateCookie(res: NextResponse, token: string) {
  res.cookies.set(GATE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_TOKEN_TTL_SEC,
  });
}

/** حالة الحماية — تعرضها صفحة الإعدادات وصفحة الدخول */
export async function GET() {
  const cfg = await readSecurity(true);
  return NextResponse.json({ protected: !!cfg.passwordHash });
}

export async function POST(req: NextRequest) {
  const ip = visitorIp(req);
  const okRate = await consumeRateLimit(`security:${ip}`, 30, 15 * 60);
  if (!okRate) {
    return NextResponse.json({ error: "محاولات كثيرة — انتظر قليلاً" }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const cfg = await readSecurity(true);

  switch (action) {
    // ---------- تعيين / تغيير كلمة السر ----------
    case "set_password": {
      const next = String(body?.next ?? "");
      if (next.length < 6) {
        return NextResponse.json({ error: "كلمة السر ٦ أحرف على الأقل" }, { status: 400 });
      }
      // التغيير (والموقع محمي) يتطلب كلمة السر الحالية نصاً — الجلسة لا تكفي
      if (cfg.passwordHash && !checkPassword(String(body?.current ?? ""), cfg)) {
        return NextResponse.json({ error: "كلمة السر الحالية غير صحيحة" }, { status: 403 });
      }
      const salt = newSalt();
      const updated = {
        ...cfg,
        salt,
        passwordHash: hashPassword(next, salt),
        version: cfg.version + 1,
      };
      await writeSecurity(updated);
      bustEdgeSecurityCache();
      // جلسة فورية لصاحب التعيين حتى لا يُقفَل خارجاً بعد التفعيل
      const res = NextResponse.json({ ok: true });
      setGateCookie(res, createGateToken(updated));
      return res;
    }

    // ---------- إزالة كلمة السر (يفتح الموقع ويمسح المفاتيح) ----------
    case "remove_password": {
      if (!cfg.passwordHash) return NextResponse.json({ ok: true });
      if (!checkPassword(String(body?.current ?? ""), cfg)) {
        return NextResponse.json({ error: "كلمة السر الحالية غير صحيحة" }, { status: 403 });
      }
      await writeSecurity({ passwordHash: null, salt: "", version: cfg.version + 1, passkeys: [] });
      bustEdgeSecurityCache();
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }
}
