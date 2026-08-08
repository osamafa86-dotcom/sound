import { describe, expect, it } from "vitest";
import { extractMessages, payloadSignature, verifySignature } from "@/lib/whatsapp/verify";

const SECRET = "app-secret-for-tests";

describe("توقيع حمولة واتساب", () => {
  it("التوقيع الصحيح يُقبل", () => {
    const raw = '{"object":"whatsapp_business_account"}';
    expect(verifySignature(raw, payloadSignature(raw, SECRET), SECRET)).toBe(true);
  });

  it("تغيير بايت واحد في الجسم يُبطل التوقيع", () => {
    const raw = '{"object":"whatsapp_business_account"}';
    const sig = payloadSignature(raw, SECRET);
    expect(verifySignature(raw + " ", sig, SECRET)).toBe(false);
  });

  it("سرّ مختلف يُرفض", () => {
    const raw = "{}";
    expect(verifySignature(raw, payloadSignature(raw, "غيره"), SECRET)).toBe(false);
  });

  it("غياب الترويسة يُرفض", () => {
    expect(verifySignature("{}", null, SECRET)).toBe(false);
  });
});

describe("استخراج الرسائل الواردة", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [{
      changes: [{
        value: {
          contacts: [{ wa_id: "905551110001", profile: { name: "سارة" } }],
          messages: [
            { id: "wamid.1", from: "905551110001", type: "text", timestamp: "1700000000", text: { body: "مرحبا" } },
            { id: "wamid.2", from: "905551110001", type: "image", timestamp: "1700000100", image: { id: "media-9", caption: "الصورة" } },
          ],
        },
      }],
    }],
  };

  it("يقرأ النص والمرسِل واسمه", () => {
    const out = extractMessages(payload);
    expect(out).toHaveLength(2);
    expect(out[0]).toMatchObject({ waId: "wamid.1", from: "905551110001", name: "سارة", text: "مرحبا" });
  });

  it("تعليق الصورة نصٌّ أيضاً، ومعرّف الوسائط يُلتقط", () => {
    const [, image] = extractMessages(payload);
    expect(image.text).toBe("الصورة");
    expect(image.mediaId).toBe("media-9");
  });

  it("حمولة الحالة (بلا messages) لا تُنتج شيئاً", () => {
    expect(extractMessages({ entry: [{ changes: [{ value: { statuses: [{ id: "x" }] } }] }] })).toEqual([]);
  });

  it("الحمولات المشوّهة لا تُسقط الاستخراج", () => {
    expect(extractMessages(null)).toEqual([]);
    expect(extractMessages({ entry: [{}] })).toEqual([]);
    expect(extractMessages({ entry: [{ changes: [{ value: { messages: [{ type: "text" }] } }] }] })).toEqual([]);
  });
});
