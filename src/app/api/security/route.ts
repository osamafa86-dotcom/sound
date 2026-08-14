import { NextRequest, NextResponse } from "next/server";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import {
  CHALLENGE_COOKIE,
  GATE_COOKIE,
  GATE_TOKEN_TTL_SEC,
  checkPassword,
  createGateToken,
  hashPassword,
  newSalt,
  readSecurity,
  verifyGateTokenNode,
  writeSecurity,
  type StoredPasskey,
} from "@/lib/security";
import { bustEdgeSecurityCache } from "@/lib/securityEdge";
import { consumeRateLimit, visitorIp } from "@/lib/rateLimit";

/**
 * إدارة حماية الموقع من صفحة /security:
 * كلمة السر (إضافة/تغيير/إزالة) + مفاتيح البصمة والوجه (Passkeys).
 * القاعدة: الموقع المفتوح يضبط حمايته أول مرة بحرية؛ وأي تعديل بعدها
 * يتطلب كلمة السر الحالية (أو جلسة دخول سارية لعمليات المفاتيح).
 */

function rp(req: NextRequest): { rpID: string; origin: string } {
  const host = req.headers.get("host") ?? "localhost";
  const rpID = host.split(":")[0];
  const proto = process.env.NODE_ENV === "production" ? "https" : "http";
  return { rpID, origin: `${proto}://${host}` };
}

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
  return NextResponse.json({
    protected: !!cfg.passwordHash,
    passkeys: cfg.passkeys.map((p) => ({ id: p.id, label: p.label, createdAt: p.createdAt })),
  });
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
  const sessionOk = verifyGateTokenNode(req.cookies.get(GATE_COOKIE)?.value, cfg);
  const currentOk =
    !cfg.passwordHash || checkPassword(String(body?.current ?? ""), cfg) || sessionOk;

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

    // ---------- تسجيل بصمة/وجه: الخيارات ----------
    case "passkey_register_options": {
      if (!cfg.passwordHash) {
        return NextResponse.json({ error: "فعّل كلمة سر أولاً — البصمة بديل للدخول لا للحماية" }, { status: 400 });
      }
      if (!currentOk) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
      const { rpID } = rp(req);
      const options = await generateRegistrationOptions({
        rpName: "لحّن",
        rpID,
        userName: "صاحب الموقع",
        userDisplayName: "صاحب الموقع",
        attestationType: "none",
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        excludeCredentials: cfg.passkeys.map((p) => ({ id: p.id })),
      });
      const res = NextResponse.json({ options });
      res.cookies.set(CHALLENGE_COOKIE, options.challenge, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 300,
      });
      return res;
    }

    // ---------- تسجيل بصمة/وجه: التحقق والحفظ ----------
    case "passkey_register_verify": {
      if (!cfg.passwordHash || !currentOk) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
      const challenge = req.cookies.get(CHALLENGE_COOKIE)?.value ?? "";
      const { rpID, origin } = rp(req);
      try {
        const verification = await verifyRegistrationResponse({
          response: body?.credential as RegistrationResponseJSON,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
        });
        if (!verification.verified || !verification.registrationInfo) throw new Error("لم يكتمل التحقق");
        const { credential } = verification.registrationInfo;
        const passkey: StoredPasskey = {
          id: credential.id,
          publicKey: Buffer.from(credential.publicKey).toString("base64"),
          counter: credential.counter,
          transports: credential.transports,
          label: String(body?.label ?? "").slice(0, 60) || `مفتاح ${cfg.passkeys.length + 1}`,
          createdAt: new Date().toISOString(),
        };
        await writeSecurity({ ...cfg, passkeys: [...cfg.passkeys, passkey] });
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json(
          { error: "فشل تسجيل البصمة: " + (e instanceof Error ? e.message : "غير معروف") },
          { status: 400 }
        );
      }
    }

    // ---------- حذف مفتاح بصمة ----------
    case "passkey_delete": {
      if (!currentOk) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
      const id = String(body?.id ?? "");
      await writeSecurity({ ...cfg, passkeys: cfg.passkeys.filter((p) => p.id !== id) });
      return NextResponse.json({ ok: true });
    }

    // ---------- دخول بالبصمة/الوجه: الخيارات (متاح قبل الدخول) ----------
    case "passkey_login_options": {
      if (!cfg.passkeys.length) return NextResponse.json({ error: "لا توجد مفاتيح مسجلة" }, { status: 400 });
      const { rpID } = rp(req);
      const options = await generateAuthenticationOptions({
        rpID,
        userVerification: "required",
        allowCredentials: cfg.passkeys.map((p) => ({ id: p.id })),
      });
      const res = NextResponse.json({ options });
      res.cookies.set(CHALLENGE_COOKIE, options.challenge, {
        httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 300,
      });
      return res;
    }

    // ---------- دخول بالبصمة/الوجه: التحقق وإصدار الجلسة ----------
    case "passkey_login_verify": {
      const cred = body?.credential as AuthenticationResponseJSON | undefined;
      const stored = cfg.passkeys.find((p) => p.id === cred?.id);
      if (!cred || !stored) return NextResponse.json({ error: "مفتاح غير معروف" }, { status: 400 });
      const challenge = req.cookies.get(CHALLENGE_COOKIE)?.value ?? "";
      const { rpID, origin } = rp(req);
      try {
        const verification = await verifyAuthenticationResponse({
          response: cred,
          expectedChallenge: challenge,
          expectedOrigin: origin,
          expectedRPID: rpID,
          requireUserVerification: true,
          credential: {
            id: stored.id,
            publicKey: new Uint8Array(Buffer.from(stored.publicKey, "base64")),
            counter: stored.counter,
          },
        });
        if (!verification.verified) throw new Error("لم يكتمل التحقق");
        // تحديث عدّاد إعادة التشغيل — ضد الاستنساخ
        await writeSecurity({
          ...cfg,
          passkeys: cfg.passkeys.map((p) =>
            p.id === stored.id ? { ...p, counter: verification.authenticationInfo.newCounter } : p
          ),
        });
        const res = NextResponse.json({ ok: true });
        setGateCookie(res, createGateToken(cfg));
        return res;
      } catch (e) {
        return NextResponse.json(
          { error: "فشل الدخول بالبصمة: " + (e instanceof Error ? e.message : "غير معروف") },
          { status: 401 }
        );
      }
    }

    default:
      return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
  }
}
