import { afterEach, describe, expect, it, vi } from "vitest";
import type { MusicRequest } from "@/lib/providers/types";

/**
 * سلّم سلسلة نماذج Lyria: الفشل التقني يتجاوز للمرشح التالي ويريح
 * المتعثر، ورفض المحتوى/الفوترة يُرمى فوراً. كل اختبار يستورد الوحدة
 * من جديد كي تُقرأ LYRIA_MODEL وذاكرة التعثر نظيفتين.
 */

const REQ: MusicRequest = {
  lyrics: "يا ليل الصبّ متى غده",
  maqamId: "hijaz",
  styleId: "tarab",
  instrumentIds: ["oud"],
  stylePrompt: "classical Arabic tarab in hijaz",
  durationSec: 30,
};

async function freshLyria(models: string) {
  vi.resetModules();
  vi.stubEnv("LYRIA_MODEL", models);
  return import("@/lib/providers/lyria");
}

function audioOk(tag: string) {
  return new Response(
    JSON.stringify({
      candidates: [
        {
          content: {
            parts: [
              { inlineData: { mimeType: "audio/mpeg", data: Buffer.from(tag).toString("base64") } },
            ],
          },
        },
      ],
    }),
    { status: 200 }
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("سلّم سلسلة نماذج Lyria", () => {
  it("الفشل التقني (400) ينتقل للمرشح التالي — ثم يريح المتعثر", async () => {
    const { lyriaMusic } = await freshLyria("model-a,model-b");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes("model-a")) {
          return new Response('{"error":{"message":"bad request shape"}}', { status: 400 });
        }
        return audioOk("mp3-b");
      })
    );

    const result = await lyriaMusic("key").generate(REQ);
    expect(result.provider).toBe("lyria");
    expect(result.audio.toString()).toBe("mp3-b");
    expect(calls.some((u) => u.includes("model-a"))).toBe(true);
    expect(calls.some((u) => u.includes("model-b"))).toBe(true);

    // التوليدة التالية في نفس النسخة تتخطى المتعثر مباشرة
    calls.length = 0;
    await lyriaMusic("key").generate(REQ);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("model-b");
  });

  it("استجابة بلا صوت تُعامل فشلاً تقنياً وتنتقل للتالي", async () => {
    const { lyriaMusic } = await freshLyria("model-a,model-b");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("model-a")
          ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "no audio" }] } }] }), {
              status: 200,
            })
          : audioOk("mp3-b")
      )
    );
    const result = await lyriaMusic("key").generate(REQ);
    expect(result.audio.toString()).toBe("mp3-b");
  });

  it("رفض مرشّح المحتوى يُرمى فوراً بلا تجربة نموذج آخر", async () => {
    const { lyriaMusic, LyriaError } = await freshLyria("model-a,model-b");
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ promptFeedback: { blockReason: "OTHER" } }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(lyriaMusic("key").generate(REQ)).rejects.toSatisfy(
      (e: unknown) => e instanceof LyriaError && e.contentRejected
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("عطل الفوترة (429 limit: 0) يُرمى فوراً — قرار حساب لا نموذج", async () => {
    const { lyriaMusic, LyriaError } = await freshLyria("model-a,model-b");
    const fetchMock = vi.fn(async () => new Response("quota limit: 0 for model", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(lyriaMusic("key").generate(REQ)).rejects.toSatisfy(
      (e: unknown) => e instanceof LyriaError && e.needsBilling
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("الصوت المرجعي (fileData) يُنزَّل عند غياب التضمين", async () => {
    const { lyriaMusic } = await freshLyria("model-a");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("files.example")) {
          return new Response(Buffer.from("mp3-file"), {
            status: 200,
            headers: { "Content-Type": "audio/mpeg" },
          });
        }
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ fileData: { mimeType: "audio/mpeg", fileUri: "https://files.example/song" } }],
                },
              },
            ],
          }),
          { status: 200 }
        );
      })
    );

    const result = await lyriaMusic("key").generate(REQ);
    expect(result.audio.toString()).toBe("mp3-file");
    expect(result.mimeType).toBe("audio/mpeg");
  });
});
