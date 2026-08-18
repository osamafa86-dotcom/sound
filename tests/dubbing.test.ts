import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DUB_MAX_BYTES,
  DUB_SOURCES,
  DUB_TARGETS,
  dubLanguageName,
  isDubSource,
  isDubTarget,
} from "@/lib/dubbing";
import {
  ElevenLabsError,
  elevenLabsDubAudio,
  elevenLabsDubStart,
  elevenLabsDubStatus,
} from "@/lib/providers/elevenlabs";
import { CREDIT_COSTS } from "@/lib/credits";
import { LIMITS, MEMBER_ONLY_SCOPES } from "@/lib/rateLimit";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("كتالوج لغات الدبلجة", () => {
  it("الرموز فريدة وبصيغة المحرك", () => {
    const codes = DUB_TARGETS.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z]{2,4}$/);
  });

  it("العربية هدف متاح — دبلجة الأعمال الأجنبية إليها", () => {
    expect(isDubTarget("ar")).toBe(true);
    expect(dubLanguageName("ar")).toBe("العربية");
  });

  it("الاكتشاف التلقائي مصدر لا هدف", () => {
    expect(DUB_SOURCES[0].code).toBe("auto");
    expect(isDubSource("auto")).toBe(true);
    expect(isDubTarget("auto")).toBe(false);
  });

  it("كل هدف يصلح مصدراً", () => {
    for (const l of DUB_TARGETS) expect(isDubSource(l.code)).toBe(true);
  });

  it("سقف الحجم يوازي حد عازل الصوت", () => {
    expect(DUB_MAX_BYTES).toBe(25 * 1024 * 1024);
  });
});

describe("مزوّد الدبلجة", () => {
  it("البدء: يرسل الحقول الصحيحة ويعيد المعرّف والتقدير", async () => {
    let captured: { url?: string; form?: FormData } = {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        captured = { url: String(url), form: init?.body as FormData };
        return new Response(
          JSON.stringify({ dubbing_id: "dub_abc123", expected_duration_sec: 42 }),
          { status: 200 }
        );
      })
    );

    const job = await elevenLabsDubStart("key", {
      file: new Blob(["audio-bytes"]),
      fileName: "scene.mp3",
      targetLang: "en",
      sourceLang: "ar",
      numSpeakers: 2,
      dropBackground: true,
      name: "مقام — scene.mp3",
    });

    expect(job).toEqual({ dubbingId: "dub_abc123", expectedSec: 42 });
    expect(captured.url).toContain("/v1/dubbing");
    expect(captured.form?.get("target_lang")).toBe("en");
    expect(captured.form?.get("source_lang")).toBe("ar");
    expect(captured.form?.get("num_speakers")).toBe("2");
    expect(captured.form?.get("drop_background_audio")).toBe("true");
    expect(captured.form?.get("file")).toBeInstanceOf(Blob);
  });

  it("البدء: «auto» والعدد صفر لا يُرسلان — سلوك المحرك الافتراضي", async () => {
    let form: FormData | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        form = init?.body as FormData;
        return new Response(JSON.stringify({ dubbing_id: "dub_x" }), { status: 200 });
      })
    );

    const job = await elevenLabsDubStart("key", {
      file: new Blob(["a"]),
      fileName: "a.mp3",
      targetLang: "tr",
      sourceLang: "auto",
      numSpeakers: 0,
    });

    expect(job.dubbingId).toBe("dub_x");
    expect(job.expectedSec).toBeUndefined();
    expect(form?.get("source_lang")).toBeNull();
    expect(form?.get("num_speakers")).toBeNull();
    expect(form?.get("drop_background_audio")).toBeNull();
  });

  it("الحالة: تُقرأ كما يعيدها المحرك مع تمرير الخطأ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ status: "dubbed", target_languages: ["en"], error: null }),
            { status: 200 }
          )
      )
    );
    const st = await elevenLabsDubStatus("key", "dub_abc");
    expect(st.status).toBe("dubbed");
    expect(st.targetLanguages).toEqual(["en"]);
    expect(st.error).toBeUndefined();
  });

  it("الحالة: مشروع مفقود يرمي ElevenLabsError برقم 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response('{"detail":{"status":"dubbing_not_found"}}', { status: 404 }))
    );
    await expect(elevenLabsDubStatus("key", "missing")).rejects.toMatchObject({
      status: 404,
      constructor: ElevenLabsError,
    });
  });

  it("التنزيل: يمرر نوع المحتوى (فيديو mp4) ويتراجع لـ mp3", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "video/mp4" },
          })
      )
    );
    const video = await elevenLabsDubAudio("key", "dub_v", "en");
    expect(video.mimeType).toBe("video/mp4");
    expect(video.provider).toBe("elevenlabs-dub");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1]), { status: 200 }))
    );
    const audio = await elevenLabsDubAudio("key", "dub_a", "en");
    expect(audio.mimeType).toBe("audio/mpeg");
  });
});

describe("حوكمة مسار الدبلجة", () => {
  it("نطاق حدود مستقل وعضوية إلزامية وكلفة موازية لثقل المسار", () => {
    expect(LIMITS.dub).toBeDefined();
    expect(LIMITS.dub.perVisitor).toBeGreaterThan(0);
    expect(MEMBER_ONLY_SCOPES.has("dub")).toBe(true);
    expect(CREDIT_COSTS.dub).toBe(30);
  });
});
