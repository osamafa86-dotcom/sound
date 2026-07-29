import { describe, expect, it } from "vitest";
import {
  appSecretProof,
  decryptToken,
  encryptToken,
  signState,
  verifyState,
} from "@/lib/facebook/crypto";
import { authorizeUrl } from "@/lib/facebook/graph";
import { FACEBOOK_SCOPES, GRAPH_VERSION } from "@/lib/facebook/config";
import { newShareId, shareUrl } from "@/lib/share";

const SECRET = "test-app-secret-0123456789";

describe("تشفير رموز الصفحات", () => {
  it("يعيد الرمز كما هو بعد فكّ التشفير", () => {
    const token = "EAAG…رمز-صفحة-طويل";
    expect(decryptToken(encryptToken(token, SECRET), SECRET)).toBe(token);
  });

  it("النص المشفّر يختلف في كل مرة (متجه تهيئة عشوائي)", () => {
    expect(encryptToken("نفس الرمز", SECRET)).not.toBe(encryptToken("نفس الرمز", SECRET));
  });

  it("لا يفكّ التشفير بمفتاح آخر", () => {
    expect(decryptToken(encryptToken("سرّ", SECRET), "مفتاح-مختلف")).toBeNull();
  });

  it("العبث بالنص المشفّر يُكشف بوسم التحقق", () => {
    const payload = encryptToken("سرّ", SECRET);
    const [v, iv, body, tag] = payload.split(".");
    const tampered = [v, iv, body.slice(0, -2) + "AA", tag].join(".");
    expect(decryptToken(tampered, SECRET)).toBeNull();
  });

  it("الصيغة التالفة تُرفض بلا استثناء", () => {
    expect(decryptToken("ليست صيغة صحيحة", SECRET)).toBeNull();
    expect(decryptToken("v2.a.b.c", SECRET)).toBeNull();
  });
});

describe("حالة OAuth", () => {
  it("الحمولة تعود سليمة بعد التحقق", () => {
    const payload = "user-123|nonce-456";
    expect(verifyState(signState(payload, SECRET), SECRET)).toBe(payload);
  });

  it("توقيع بسرّ آخر يُرفض", () => {
    expect(verifyState(signState("user-1|n", "سرّ آخر"), SECRET)).toBeNull();
  });

  it("تبديل الحمولة مع إبقاء التوقيع يُرفض", () => {
    const signed = signState("user-1|nonce", SECRET);
    const forged = `${Buffer.from("user-2|nonce", "utf8").toString("base64url")}.${signed.split(".")[1]}`;
    expect(verifyState(forged, SECRET)).toBeNull();
  });

  it("الصيغة الناقصة تُرفض", () => {
    expect(verifyState("بلا نقطة", SECRET)).toBeNull();
  });
});

describe("برهان سرّ التطبيق", () => {
  it("ثابت لنفس المدخلات ومختلف باختلاف الرمز", () => {
    const a = appSecretProof("token-a", SECRET);
    expect(a).toBe(appSecretProof("token-a", SECRET));
    expect(a).not.toBe(appSecretProof("token-b", SECRET));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("رابط نافذة الموافقة", () => {
  const cfg = { appId: "123456789", appSecret: SECRET, tokenSecret: SECRET };
  const url = new URL(
    authorizeUrl(cfg, "https://maqam.test/api/facebook/callback", "signed-state")
  );

  it("يشير إلى نافذة فيسبوك بالنسخة نفسها المستخدمة في Graph", () => {
    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toBe(`/${GRAPH_VERSION}/dialog/oauth`);
  });

  it("يحمل المعرّف ورابط الرجوع والحالة ونوع الاستجابة", () => {
    expect(url.searchParams.get("client_id")).toBe("123456789");
    expect(url.searchParams.get("redirect_uri")).toBe("https://maqam.test/api/facebook/callback");
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("response_type")).toBe("code");
  });

  it("يطلب أذونات الصفحات الأربعة ولا شيء غيرها", () => {
    expect(url.searchParams.get("scope")?.split(",")).toEqual([...FACEBOOK_SCOPES]);
  });

  it("لا يسرّب سرّ التطبيق في رابط يمرّ بالمتصفح", () => {
    expect(url.toString()).not.toContain(SECRET);
  });
});

describe("روابط المشاركة", () => {
  it("المعرّف غير مكرر وبطول ثابت", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newShareId()));
    expect(ids.size).toBe(200);
    for (const id of ids) expect(id).toHaveLength(22);
  });

  it("المعرّف آمن في الروابط (base64url بلا رموز تحتاج ترميزاً)", () => {
    for (let i = 0; i < 50; i++) expect(newShareId()).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("الرابط يُبنى بلا شرطة مكررة مهما كان الأصل", () => {
    expect(shareUrl("abc", "https://maqam.test")).toBe("https://maqam.test/s/abc");
    expect(shareUrl("abc", "https://maqam.test/")).toBe("https://maqam.test/s/abc");
  });
});
