import { describe, expect, it } from "vitest";
import {
  PEAK_CEILING,
  dbToLinear,
  gainToTarget,
  integratedLufs,
  kWeight,
  limitPeaks,
} from "@/lib/loudness";

const RATE = 48000;

function sine(freq: number, seconds: number, amp: number): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / RATE);
  }
  return out;
}

describe("قياس الجهارة المتكاملة (BS.1770)", () => {
  it("جيبية 997Hz كاملة المدى ستيريو ≈ -0.7 LUFS (القيمة المرجعية للمواصفة)", () => {
    const s = sine(997, 3, 1);
    const lufs = integratedLufs([s, s.slice()], RATE)!;
    expect(lufs).toBeGreaterThan(-1.6);
    expect(lufs).toBeLessThan(0.2);
  });

  it("خفض السعة 20dB يخفض القياس ~20 LU — خطية المقياس", () => {
    const loud = sine(997, 3, 0.5);
    const quiet = sine(997, 3, 0.05);
    const diff = integratedLufs([loud, loud.slice()], RATE)! - integratedLufs([quiet, quiet.slice()], RATE)!;
    expect(diff).toBeGreaterThan(19);
    expect(diff).toBeLessThan(21);
  });

  it("مقطع أقصر من نافذة القياس أو صامت ⟵ null", () => {
    expect(integratedLufs([new Float32Array(100)], RATE)).toBeNull();
    expect(integratedLufs([new Float32Array(RATE)], RATE)).toBeNull();
  });

  it("ترشيح K يحجب المكوّن الثابت (DC)", () => {
    const dc = new Float32Array(RATE).fill(0.8);
    const filtered = kWeight(dc, RATE);
    expect(Math.abs(filtered[filtered.length - 1])).toBeLessThan(0.01);
  });
});

describe("كسب الهدف ومحدد الذروة", () => {
  it("الكسب نحو -14 LUFS مع سقف رفع يحمي شبه الصامت", () => {
    expect(gainToTarget(-24)).toBe(10);
    expect(gainToTarget(-9)).toBe(-5);
    expect(gainToTarget(-40)).toBe(12); // مقصوص عند الحد الأقصى
    expect(dbToLinear(20)).toBeCloseTo(10, 5);
  });

  it("قمة فوق السقف تُخفض إليه والبعيد عنها لا يُمس ويُعاد true", () => {
    const ch = sine(200, 1, 0.5);
    ch[24000] = 1.5; // قمة شاذة في المنتصف
    const limited = limitPeaks([ch], RATE);
    expect(limited).toBe(true);
    let max = 0;
    for (const v of ch) max = Math.max(max, Math.abs(v));
    expect(max).toBeLessThanOrEqual(PEAK_CEILING * 1.02);
    // بداية الملف أبعد من نافذتي النظرة والعودة — سعتها الأصلية سليمة
    expect(Math.abs(ch[120])).toBeGreaterThan(0);
    expect(Math.abs(ch[120])).toBeLessThanOrEqual(0.5);
  });

  it("مقطع كله دون السقف يمر بلا أي تغيير", () => {
    const ch = sine(200, 0.5, 0.3);
    const before = ch.slice();
    expect(limitPeaks([ch], RATE)).toBe(false);
    expect(ch[1000]).toBe(before[1000]);
  });
});
