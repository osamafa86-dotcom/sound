import { describe, expect, it } from "vitest";
import { buildLrc, buildSrt, findActiveWord, groupWords, type KaraokeWord } from "@/lib/karaoke";

const words: KaraokeWord[] = [
  { text: "في", start: 0.5, end: 0.8 },
  { text: "خاطري", start: 0.9, end: 1.4 },
  { text: "حكاية", start: 1.5, end: 2.1 },
  // فجوة صمت > ٠.٧ ثانية تفتح سطراً جديداً
  { text: "غنّوا", start: 3.2, end: 3.6 },
  { text: "معي", start: 3.7, end: 4.0 },
];

describe("الكاريوكي", () => {
  it("الكلمة النشطة: آخر كلمة بدأت قبل اللحظة الحالية", () => {
    expect(findActiveWord(words, 0.2)).toBe(-1);
    expect(findActiveWord(words, 1.0)).toBe(1);
    expect(findActiveWord(words, 10)).toBe(4);
  });

  it("التجميع أسطراً عند فجوات الصمت", () => {
    const lines = groupWords(words);
    expect(lines).toHaveLength(2);
    expect(lines[0].text).toBe("في خاطري حكاية");
    expect(lines[1].start).toBe(3.2);
  });

  it("SRT: ترقيم ومدى زمني بصيغة الساعات:الدقائق:الثواني,ميلي", () => {
    const srt = buildSrt(words);
    expect(srt).toContain("1\n00:00:00,500 --> 00:00:02,100\nفي خاطري حكاية");
    expect(srt).toContain("2\n00:00:03,200 --> 00:00:04,000\nغنّوا معي");
  });

  it("LRC: طابع لكل سطر مع ترويسة العنوان", () => {
    const lrc = buildLrc(words, "حكايتي");
    expect(lrc).toContain("[ti:حكايتي]");
    expect(lrc).toContain("[00:00.50]في خاطري حكاية");
    expect(lrc).toContain("[00:03.20]غنّوا معي");
  });
});
