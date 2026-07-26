import { describe, expect, it } from "vitest";
import { rangeResponse } from "@/lib/httpRange";

const data = Buffer.from("0123456789");
const req = (range?: string) =>
  new Request("http://x/audio", { headers: range ? { range } : {} });

describe("استجابة المدى (متطلب سفاري للوسائط)", () => {
  it("بلا مدى: 200 كاملة مع Accept-Ranges", async () => {
    const res = rangeResponse(req(), data, "audio/wav");
    expect(res.status).toBe(200);
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("Content-Length")).toBe("10");
    expect(await res.text()).toBe("0123456789");
  });

  it("مدى جزئي: 206 مع Content-Range صحيح", async () => {
    const res = rangeResponse(req("bytes=2-5"), data, "audio/wav");
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 2-5/10");
    expect(await res.text()).toBe("2345");
  });

  it("مدى مفتوح النهاية (استكشاف سفاري bytes=0-)", async () => {
    const res = rangeResponse(req("bytes=0-"), data, "audio/wav");
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe("bytes 0-9/10");
    expect(await res.text()).toBe("0123456789");
  });

  it("لاحقة bytes=-3 تعيد آخر ٣ بايتات", async () => {
    const res = rangeResponse(req("bytes=-3"), data, "audio/wav");
    expect(res.status).toBe(206);
    expect(await res.text()).toBe("789");
  });

  it("مدى خارج الحجم: 416 مع الحجم الكلي", () => {
    const res = rangeResponse(req("bytes=50-60"), data, "audio/wav");
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe("bytes */10");
  });
});
