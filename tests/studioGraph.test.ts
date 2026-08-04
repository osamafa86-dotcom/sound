import { describe, expect, it } from "vitest";
import {
  AI_MODES,
  NODE_DEFS,
  PORT_META,
  aiModeCost,
  canConnect,
  executionLayers,
  executionOrder,
  inputEdgesByPort,
  inputSourceOf,
  nodePorts,
  resolveInput,
  resolveOutput,
  type NodeKind,
  type PortRef,
} from "@/lib/studio/graph";

const ref = (kind: NodeKind, handle?: string, config?: Record<string, string>): PortRef => ({
  kind,
  config,
  handle,
});

describe("توافق ربط البطاقات (منافذ مسماة)", () => {
  it("النص يتصل بما يستقبل نصاً — والصوت بما يستقبل صوتاً", () => {
    expect(canConnect(ref("text"), ref("tts"))).toBe(true);
    expect(canConnect(ref("text"), ref("lyrics"))).toBe(true);
    expect(canConnect(ref("lyrics"), ref("song"))).toBe(true);
    expect(canConnect(ref("tts"), ref("isolate"))).toBe(true);
    expect(canConnect(ref("song"), ref("save"))).toBe(true);
  });

  it("الأنواع غير المتوافقة تُرفض", () => {
    expect(canConnect(ref("text"), ref("isolate"))).toBe(false); // نص إلى مستقبل صوت
    expect(canConnect(ref("tts"), ref("enhance"))).toBe(false); // صوت إلى مستقبل نص
    expect(canConnect(ref("tts"), ref("song"))).toBe(false); // صوت إلى منفذ الكلمات
    expect(canConnect(ref("save"), ref("tts"))).toBe(false); // الحفظ بلا خرج
    expect(canConnect(ref("tts"), ref("text"))).toBe(false); // النص بلا دخل
  });

  it("بصمة الصوت: خرج بنفسجي يقبله منفذ البصمة في توليد الصوت حصراً", () => {
    expect(canConnect(ref("voiceprint"), ref("tts", "voice"))).toBe(true);
    expect(canConnect(ref("voiceprint"), ref("tts", "in"))).toBe(false);
    expect(canConnect(ref("voiceprint"), ref("tts"))).toBe(false); // المقبض الغائب = المنفذ الأول (نص)
    expect(canConnect(ref("voiceprint"), ref("song"))).toBe(false);
    expect(canConnect(ref("upload"), ref("voiceprint"))).toBe(true); // عينة الصوت
  });

  it("اللحن المرجعي: منفذ صوتي اختياري على التلحين والموسيقى", () => {
    expect(canConnect(ref("upload"), ref("song", "melody"))).toBe(true);
    expect(canConnect(ref("upload"), ref("music", "melody"))).toBe(true);
    expect(canConnect(ref("text"), ref("song", "melody"))).toBe(false);
    expect(resolveInput(ref("song", "melody"))?.optional).toBe(true);
  });

  it("فصل الأغنية: دخل صوتي وخرجان صوتيان مسميان", () => {
    const { outputs } = nodePorts("split");
    expect(outputs.map((o) => o.id)).toEqual(["vocals", "inst"]);
    expect(outputs.every((o) => o.type === "audio")).toBe(true);
    expect(canConnect(ref("upload"), ref("split"))).toBe(true);
    expect(canConnect(ref("split", "vocals"), ref("stt"))).toBe(true);
    expect(canConnect(ref("split", "inst"), ref("save"))).toBe(true);
  });

  it("بطاقة الذكاء: الخرج يتبدل نوعاً مع الوضع — والكلفة معه", () => {
    expect(resolveOutput(ref("ai"))?.type).toBe("text");
    expect(resolveOutput(ref("ai", undefined, { mode: "image" }))?.type).toBe("image");
    expect(resolveOutput(ref("ai", undefined, { mode: "video" }))?.type).toBe("video");
    expect(aiModeCost({})).toBe(1);
    expect(aiModeCost({ mode: "video" })).toBe(20);
    // وضع نصي يوصل للتلحين، ووضع صورة لا
    expect(canConnect(ref("ai"), ref("song"))).toBe(true);
    expect(canConnect(ref("ai", undefined, { mode: "image" }), ref("song"))).toBe(false);
  });

  it("المنفذ الجمعي في الذكاء يقبل نصاً وصوتاً وصورة وفيديو — لا بصمة", () => {
    const ctx = NODE_DEFS.ai.inputs[0];
    expect(ctx.multi).toBe(true);
    expect(canConnect(ref("text"), ref("ai", "ctx"))).toBe(true);
    expect(canConnect(ref("song"), ref("ai", "ctx"))).toBe(true);
    expect(canConnect(ref("ai", undefined, { mode: "image" }), ref("ai", "ctx"))).toBe(true);
    expect(canConnect(ref("voiceprint"), ref("ai", "ctx"))).toBe(false);
  });

  it("التفريغ النصي جسر الصوت إلى النص: صوت ← تفريغ ← تلحين", () => {
    expect(canConnect(ref("tts"), ref("stt"))).toBe(true);
    expect(canConnect(ref("isolate"), ref("stt"))).toBe(true);
    expect(canConnect(ref("stt"), ref("song"))).toBe(true);
    expect(canConnect(ref("stt"), ref("enhance"))).toBe(true);
  });

  it("كل بطاقة معرّفة كاملة الحقول ومنافذها فريدة المعرفات", () => {
    for (const [kind, def] of Object.entries(NODE_DEFS)) {
      expect(def.kind).toBe(kind as NodeKind);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.inputs.length + def.outputs.length).toBeGreaterThan(0);
      const inIds = def.inputs.map((p) => p.id);
      const outIds = def.outputs.map((p) => p.id);
      expect(new Set(inIds).size).toBe(inIds.length);
      expect(new Set(outIds).size).toBe(outIds.length);
      for (const p of def.inputs) expect(p.accepts.length).toBeGreaterThan(0);
    }
    expect(AI_MODES.map((m) => m.id)).toEqual(["text", "image", "video"]);
    for (const meta of Object.values(PORT_META)) {
      expect(meta.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(meta.label.length).toBeGreaterThan(0);
    }
  });
});

describe("موجات التشغيل المتوازي والترتيب", () => {
  const nodes = (["a", "b", "c", "d"] as const).map((id) => ({ id, kind: "text" as NodeKind }));

  it("سلسلة خطية: موجة لكل بطاقة بالترتيب", () => {
    const layers = executionLayers(nodes, [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
    ]);
    expect(layers).toEqual([["a"], ["b"], ["c"], ["d"]]);
  });

  it("المعيّن: الفرعان المستقلان في موجة واحدة يعملان معاً", () => {
    const layers = executionLayers(nodes, [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "d" },
      { source: "c", target: "d" },
    ]);
    expect(layers).toEqual([["a"], ["b", "c"], ["d"]]);
  });

  it("الدورة المغلقة تُكتشف وتعيد null", () => {
    expect(
      executionLayers(nodes.slice(0, 3), [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
        { source: "c", target: "a" },
      ])
    ).toBeNull();
    expect(
      executionOrder(nodes.slice(0, 3), [
        { source: "a", target: "b" },
        { source: "b", target: "c" },
        { source: "c", target: "a" },
      ])
    ).toBeNull();
  });

  it("الترتيب المسطّح يوافق الموجات", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
    ];
    expect(executionOrder(nodes, edges)?.[0]).toBe("a");
    expect(executionOrder(nodes, edges)).toHaveLength(4);
  });

  it("مصدر مدخل البطاقة يُحل من الروابط", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    expect(inputSourceOf("b", edges)).toBe("a");
    expect(inputSourceOf("a", edges)).toBeNull();
  });

  it("تجميع الوصلات حسب المنفذ — والوصلة القديمة بلا مقبض تُنسب للمنفذ الأول", () => {
    const edges = [
      { source: "a", target: "z" }, // بلا مقبض ← المنفذ الأول (in)
      { source: "b", target: "z", targetHandle: "voice" },
    ];
    const byPort = inputEdgesByPort("z", "tts", {}, edges);
    expect(byPort.get("in")?.map((e) => e.source)).toEqual(["a"]);
    expect(byPort.get("voice")?.map((e) => e.source)).toEqual(["b"]);
  });

  it("المنفذ الجمعي يجمع كل وصلاته بترتيبها", () => {
    const edges = [
      { source: "a", target: "z", targetHandle: "ctx" },
      { source: "b", target: "z", targetHandle: "ctx" },
      { source: "c", target: "z", targetHandle: "ctx" },
    ];
    const byPort = inputEdgesByPort("z", "ai", {}, edges);
    expect(byPort.get("ctx")?.map((e) => e.source)).toEqual(["a", "b", "c"]);
  });
});
