import { describe, expect, it } from "vitest";
import {
  NODE_DEFS,
  canConnect,
  executionOrder,
  inputSourceOf,
  type NodeKind,
} from "@/lib/studio/graph";

describe("توافق ربط البطاقات", () => {
  it("النص يتصل بما يستقبل نصاً — والصوت بما يستقبل صوتاً", () => {
    expect(canConnect("text", "tts")).toBe(true);
    expect(canConnect("text", "lyrics")).toBe(true);
    expect(canConnect("lyrics", "song")).toBe(true);
    expect(canConnect("tts", "isolate")).toBe(true);
    expect(canConnect("song", "save")).toBe(true);
  });

  it("الأنواع غير المتوافقة تُرفض", () => {
    expect(canConnect("text", "isolate")).toBe(false); // نص إلى مستقبل صوت
    expect(canConnect("tts", "enhance")).toBe(false); // صوت إلى مستقبل نص
    expect(canConnect("save", "tts")).toBe(false); // الحفظ بلا خرج
    expect(canConnect("tts", "text")).toBe(false); // النص بلا دخل
  });

  it("كل بطاقة معرّفة كاملة الحقول", () => {
    for (const [kind, def] of Object.entries(NODE_DEFS)) {
      expect(def.kind).toBe(kind as NodeKind);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.input !== null || def.output !== null).toBe(true);
    }
  });
});

describe("الترتيب الطوبولوجي للتشغيل", () => {
  const nodes = (["a", "b", "c", "d"] as const).map((id) => ({ id, kind: "text" as NodeKind }));

  it("سلسلة خطية تُرتب من المصدر للنهاية", () => {
    const order = executionOrder(nodes, [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "d" },
    ]);
    expect(order).toEqual(["a", "b", "c", "d"]);
  });

  it("التفرع: المصدر قبل كل فروعه", () => {
    const order = executionOrder(nodes, [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "a", target: "d" },
    ]);
    expect(order?.[0]).toBe("a");
    expect(order).toHaveLength(4);
  });

  it("الدورة المغلقة تُكتشف وتعيد null", () => {
    const order = executionOrder(nodes.slice(0, 3), [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
      { source: "c", target: "a" },
    ]);
    expect(order).toBeNull();
  });

  it("مصدر مدخل البطاقة يُحل من الروابط", () => {
    const edges = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    expect(inputSourceOf("b", edges)).toBe("a");
    expect(inputSourceOf("a", edges)).toBeNull();
  });
});
