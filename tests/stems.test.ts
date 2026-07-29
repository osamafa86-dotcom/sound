import { describe, expect, it } from "vitest";
import { encodeWavPcm16, mixVocalOverMusic, removeCenter } from "@/lib/stems";

const RATE = 44100;

function sine(freq: number, seconds: number, amp = 0.8): Float32Array {
  const out = new Float32Array(Math.round(seconds * RATE));
  for (let i = 0; i < out.length; i++) {
    out[i] = amp * Math.sin((2 * Math.PI * freq * i) / RATE);
  }
  return out;
}

/** جذر متوسط المربعات على النصف الأخير — يتجاوز فترة استقرار المرشّح */
function rms(x: Float32Array): number {
  let sum = 0;
  const start = Math.floor(x.length / 2);
  for (let i = start; i < x.length; i++) sum += x[i] * x[i];
  return Math.sqrt(sum / (x.length - start));
}

describe("إلغاء القناة الوسطى (النسخة الآلية)", () => {
  it("يمحو المحتوى الأوسط عالي التردد — الغناء", () => {
    const vocal = sine(1000, 0.3);
    const { left, right } = removeCenter(vocal, vocal.slice(), RATE);
    expect(rms(left) / rms(vocal)).toBeLessThan(0.1);
    expect(rms(right) / rms(vocal)).toBeLessThan(0.1);
  });

  it("يحتفظ بالباص الأوسط — الإيقاع لا يختفي", () => {
    const bass = sine(60, 0.5);
    const { left } = removeCenter(bass, bass.slice(), RATE);
    expect(rms(left) / rms(bass)).toBeGreaterThan(0.6);
  });

  it("يبقي المحتوى الجانبي (الآلات الموزعة) كما هو", () => {
    const x = sine(700, 0.3);
    const inverted = x.map((v) => -v) as Float32Array;
    const { left, right } = removeCenter(x, inverted, RATE);
    // منتصف معدوم ⟵ لا باص مضاف، والجانب يعود بالطور نفسه في كل قناة
    expect(rms(left) / rms(x)).toBeGreaterThan(0.95);
    expect(left[1000]).toBeCloseTo(x[1000], 5);
    expect(right[1000]).toBeCloseTo(-x[1000], 5);
  });
});

describe("مزج الغناء فوق اللحن", () => {
  const silence = () => new Float32Array(10);

  it("الإزاحة الموجبة تؤخر الغناء داخل الخط الزمني", () => {
    const vocal = Float32Array.from([1, 0.5]);
    const { left, right } = mixVocalOverMusic(silence(), silence(), vocal, 10, {
      vocalGain: 0.5,
      vocalOffsetSec: 0.3,
    });
    expect(left[2]).toBe(0);
    expect(left[3]).toBeCloseTo(0.5, 5);
    expect(right[4]).toBeCloseTo(0.25, 5);
  });

  it("الإزاحة السالبة تقدّم الغناء — تعويض تأخير التسجيل", () => {
    const vocal = Float32Array.from([0, 0, 0.8, 0.4]);
    const { left } = mixVocalOverMusic(silence(), silence(), vocal, 10, {
      vocalOffsetSec: -0.2,
    });
    expect(left[0]).toBeCloseTo(0.8, 5);
    expect(left[1]).toBeCloseTo(0.4, 5);
  });

  it("الناتج يتسع لذيل الغناء بعد نهاية الموسيقى", () => {
    const music = new Float32Array(5);
    const vocal = new Float32Array(12);
    const { left } = mixVocalOverMusic(music, music.slice(), vocal, 10, {});
    expect(left.length).toBe(12);
  });

  it("حماية التشبع: تخفيض شامل يحفظ نسب المزيج", () => {
    const music = Float32Array.from([0.9, 0.45]);
    const vocal = Float32Array.from([0.9, 0.45]);
    const { left, limited } = mixVocalOverMusic(music, music.slice(), vocal, 10, {});
    expect(limited).toBe(true);
    expect(Math.max(...left.map(Math.abs))).toBeCloseTo(0.98, 5);
    // النسبة بين العينتين محفوظة بعد التخفيض
    expect(left[0] / left[1]).toBeCloseTo(2, 5);
  });

  it("بلا تجاوز للذروة لا يُخفَّض شيء", () => {
    const music = Float32Array.from([0.3]);
    const vocal = Float32Array.from([0.3]);
    const { left, limited } = mixVocalOverMusic(music, music.slice(), vocal, 10, {});
    expect(limited).toBe(false);
    expect(left[0]).toBeCloseTo(0.6, 5);
  });
});

describe("ترميز WAV PCM16", () => {
  it("ترويسة ستيريو سليمة وحجم بيانات مطابق", () => {
    const l = Float32Array.from([0.5, -1, 1, 0]);
    const r = Float32Array.from([0, 0.25, -0.25, 0]);
    const buf = encodeWavPcm16([l, r], RATE);
    const view = new DataView(buf);

    expect(buf.byteLength).toBe(44 + 4 * 4);
    expect(view.getUint16(22, true)).toBe(2); // قناتان
    expect(view.getUint32(24, true)).toBe(RATE);
    expect(view.getUint16(32, true)).toBe(4); // bytes per frame
    expect(view.getUint32(40, true)).toBe(16); // data size

    // أول إطار متشابك: يسار ثم يمين
    expect(view.getInt16(44, true)).toBe(Math.round(0.5 * 32767));
    expect(view.getInt16(46, true)).toBe(0);
  });

  it("القيم خارج المدى تُقصّ إلى ‎±1 قبل الترميز", () => {
    const buf = encodeWavPcm16([Float32Array.from([2, -2])], RATE);
    const view = new DataView(buf);
    expect(view.getUint16(22, true)).toBe(1); // أحادي
    expect(view.getInt16(44, true)).toBe(32767);
    expect(view.getInt16(46, true)).toBe(-32767);
  });
});
