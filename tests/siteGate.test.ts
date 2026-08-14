import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkGatePassword,
  createGateToken,
  timingSafeEqual,
  verifyGateToken,
} from "@/lib/siteGate";

describe("بوابة كلمة سر الموقع", () => {
  const originalPassword = process.env.SITE_PASSWORD;
  const originalSecret = process.env.SITE_GATE_SECRET;

  beforeEach(() => {
    delete process.env.SITE_PASSWORD;
    delete process.env.SITE_GATE_SECRET;
  });
  afterEach(() => {
    if (originalPassword === undefined) delete process.env.SITE_PASSWORD;
    else process.env.SITE_PASSWORD = originalPassword;
    if (originalSecret === undefined) delete process.env.SITE_GATE_SECRET;
    else process.env.SITE_GATE_SECRET = originalSecret;
    vi.useRealTimers();
  });

  it("المقارنة بزمن ثابت تعمل بشكل صحيح", () => {
    expect(timingSafeEqual("admin123", "admin123")).toBe(true);
    expect(timingSafeEqual("admin123", "admin124")).toBe(false);
    expect(timingSafeEqual("short", "muchlonger")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("كلمة السر الافتراضية admin123 تُقبل بلا أي إعداد بيئي", () => {
    expect(checkGatePassword("admin123")).toBe(true);
    expect(checkGatePassword("wrong")).toBe(false);
    expect(checkGatePassword("")).toBe(false);
  });

  it("SITE_PASSWORD المخصصة تُقصي كلمة السر الافتراضية", () => {
    process.env.SITE_PASSWORD = "كلمة-سري-الخاصة";
    expect(checkGatePassword("كلمة-سري-الخاصة")).toBe(true);
    expect(checkGatePassword("admin123")).toBe(false);
  });

  it("رمز صادر بنجاح يُتحقّق منه بنجاح", async () => {
    const token = await createGateToken();
    expect(await verifyGateToken(token)).toBe(true);
  });

  it("يرفض رموزاً بلا توقيع أو مشوّهة أو فارغة", async () => {
    expect(await verifyGateToken(undefined)).toBe(false);
    expect(await verifyGateToken(null)).toBe(false);
    expect(await verifyGateToken("")).toBe(false);
    expect(await verifyGateToken("123456")).toBe(false); // بلا نقطة فاصلة
    expect(await verifyGateToken("123456.توقيع-خاطئ")).toBe(false);
  });

  it("يرفض رمزاً وُقّع بسرّ مختلف (لا يمكن تزويره بلا معرفة السرّ)", async () => {
    const token = await createGateToken();
    process.env.SITE_GATE_SECRET = "سرّ-مختلف-تماماً";
    expect(await verifyGateToken(token)).toBe(false);
  });

  it("رمز منتهي الصلاحية يُرفض حتى لو كان توقيعه صحيحاً", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = await createGateToken();
    expect(await verifyGateToken(token)).toBe(true);

    vi.setSystemTime(new Date("2026-02-15T00:00:00Z")); // تجاوز الشهر (٣٠ يوماً)
    expect(await verifyGateToken(token)).toBe(false);
  });

  it("تغيير SITE_PASSWORD يُبطل الرموز القديمة الموقّعة بالسرّ المشتق منها", async () => {
    process.env.SITE_PASSWORD = "سر-أول";
    const token = await createGateToken();
    expect(await verifyGateToken(token)).toBe(true);

    process.env.SITE_PASSWORD = "سر-ثانٍ";
    expect(await verifyGateToken(token)).toBe(false);
  });
});
