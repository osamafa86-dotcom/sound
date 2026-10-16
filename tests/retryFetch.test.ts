import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchWithRetry,
  geminiGenerate,
  geminiScriptModels,
  geminiStructured,
  geminiTextModels,
} from "@/lib/retryFetch";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

describe("سلسلة نماذج Gemini النصية", () => {
  it("الازدحام المستمر على الأول ينتقل للثاني", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GEMINI_MODEL", "model-a,model-b");
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return String(url).includes("model-a")
          ? new Response("busy", { status: 503 })
          : new Response('{"ok":true}', { status: 200 });
      })
    );

    const p = geminiGenerate("key", { contents: [] });
    await vi.advanceTimersByTimeAsync(7000);
    const res = await p;
    expect(res.status).toBe(200);
    expect(urls.filter((u) => u.includes("model-a"))).toHaveLength(3); // إعادة المحاولة قبل الانتقال
    expect(urls.some((u) => u.includes("model-b"))).toBe(true);
  });

  it("فشل السلسلة كلها يعيد آخر استجابة فاشلة", async () => {
    vi.stubEnv("GEMINI_MODEL", "model-a,model-b");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 400 })));
    const res = await geminiGenerate("key", {});
    expect(res.status).toBe(400);
  });

  it("GEMINI_MODEL بقيمة واحدة يحصر السلسلة بها", () => {
    vi.stubEnv("GEMINI_MODEL", "my-model");
    expect(geminiTextModels()).toEqual(["my-model"]);
  });

  it("الافتراضي سلسلة من نموذجين", () => {
    expect(geminiTextModels()).toEqual(["gemini-3.6-flash", "gemini-3.8-flash"]);
  });
});

describe("سلسلة كتّاب السيناريو الصوتي (الأحدث أولاً)", () => {
  const ok = (text: string) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });
  const read = (json: unknown) => {
    const text = (json as { candidates: { content: { parts: { text: string }[] } }[] }).candidates[0].content
      .parts[0].text;
    return JSON.parse(text) as { v: number };
  };

  it("الافتراضي: gemini-3.8-flash أولاً ثم المجرَّب 3.6", () => {
    expect(geminiScriptModels()).toEqual(["gemini-3.8-flash", "gemini-3.6-flash"]);
  });

  it("GEMINI_SCRIPT_MODEL يثبّت السلسلة أو يعكسها", () => {
    vi.stubEnv("GEMINI_SCRIPT_MODEL", "gemini-3.6-flash");
    expect(geminiScriptModels()).toEqual(["gemini-3.6-flash"]);
  });

  it("الناجح من الأول يُعاد بلا لمس للثاني", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        return ok('{"v":1}');
      })
    );
    expect(await geminiStructured("key", {}, read, ["new", "old"])).toEqual({ v: 1 });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/models/new:generateContent");
  });

  it("ناتج لا يُقرأ من الأحدث ينقل للمجرَّب بدل إسقاط الميزة", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (String(url).includes("/new:") ? ok("not json") : ok('{"v":2}')))
    );
    expect(await geminiStructured("key", {}, read, ["new", "old"])).toEqual({ v: 2 });
  });

  it("فشل HTTP غير ازدحامي ينتقل فوراً للتالي", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("/new:") ? new Response("no such model", { status: 404 }) : ok('{"v":3}')
      )
    );
    expect(await geminiStructured("key", {}, read, ["new", "old"])).toEqual({ v: 3 });
  });

  it("فشل الجميع يرمي خطأ آخر نموذج كما هو", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad", { status: 400 })));
    await expect(geminiStructured("key", {}, read, ["new", "old"])).rejects.toThrow(/^Gemini 400: bad/);
  });
});
