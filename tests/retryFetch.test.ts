import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "@/lib/retryFetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("إعادة المحاولة على الازدحام", () => {
  it("503 يُعاد مرتين ثم ينجح", async () => {
    vi.useFakeTimers();
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => (++calls < 3 ? new Response("busy", { status: 503 }) : new Response("ok", { status: 200 })))
    );
    const p = fetchWithRetry("https://x.example/", {});
    await vi.advanceTimersByTimeAsync(7000);
    const res = await p;
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
  });

  it("بعد استنفاد المحاولات يعاد آخر 503 كما هو", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("busy", { status: 503 })));
    const p = fetchWithRetry("https://x.example/", {});
    await vi.advanceTimersByTimeAsync(7000);
    expect((await p).status).toBe(503);
  });

  it("الأخطاء غير الازدحامية تمر فوراً بلا إعادة", async () => {
    const fetchMock = vi.fn(async () => new Response("bad", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await fetchWithRetry("https://x.example/", {});
    expect(res.status).toBe(400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
