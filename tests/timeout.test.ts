import { describe, expect, it } from "vitest";
import { UNREACHABLE, isNetworkError, withTimeout } from "@/lib/timeout";

describe("مهلة العمليات الشبكية", () => {
  it("تمرّر النتيجة عند الاستجابة قبل المهلة", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50)).resolves.toBe("ok");
  });

  it("تمرّر الفشل الحقيقي كما هو بلا تشويش", async () => {
    await expect(withTimeout(Promise.reject(new Error("invalid login")), 50)).rejects.toThrow(
      "invalid login"
    );
  });

  it("تفشل برسالة مفهومة عندما لا يعود الطلب أبداً", async () => {
    // الطلب المعلّق هو سبب زر «جارٍ...» الذي يدور بلا نهاية
    await expect(withTimeout(new Promise(() => {}), 20)).rejects.toThrow(UNREACHABLE);
  });

  it("تنظّف المؤقّت فلا تُبقي العملية حيّة بعد النجاح", async () => {
    const before = process.listenerCount("exit");
    await withTimeout(Promise.resolve(1), 60_000);
    expect(process.listenerCount("exit")).toBe(before);
  });
});

describe("تمييز أخطاء الشبكة", () => {
  it("يتعرّف على صيغ المتصفحات المختلفة", () => {
    for (const m of ["Failed to fetch", "NetworkError when attempting to fetch", "Load failed", UNREACHABLE]) {
      expect(isNetworkError(m)).toBe(true);
    }
  });

  it("لا يخلط أخطاء المصادقة بأخطاء الشبكة", () => {
    for (const m of ["Invalid login credentials", "User already registered"]) {
      expect(isNetworkError(m)).toBe(false);
    }
  });
});
