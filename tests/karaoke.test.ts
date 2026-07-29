import { describe, expect, it } from "vitest";
import {
  alignWordsToLyrics,
  buildLrc,
  buildSrt,
  findActiveWord,
  groupWords,
  type KaraokeWord,
} from "@/lib/karaoke";

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

describe("محاذاة التفريغ مع النص المكتوب المشكّل", () => {
  const transcript: KaraokeWord[] = [
    { text: "يا", start: 0, end: 0.2 },
    { text: "ليل", start: 0.3, end: 0.6 },
    { text: "يا", start: 0.7, end: 0.9 },
    { text: "عين", start: 1.0, end: 1.3 },
    { text: "وقلبي", start: 1.5, end: 1.9 },
    { text: "حزين.", start: 2.0, end: 2.4 },
  ];

  it("يستبدل بالكلمات العارية صورتها المشكّلة ويبقي توقيتها ويتخطى الترويسات", () => {
    const written = "لازمة:\nيَا لَيْل يَا عِين\nوَقَلْبِي حَزِين";
    const aligned = alignWordsToLyrics(transcript, written);
    expect(aligned.map((w) => w.text)).toEqual([
      "يَا",
      "لَيْل",
      "يَا",
      "عِين",
      "وَقَلْبِي",
      "حَزِين",
    ]);
    // التوقيت لا يُمس
    expect(aligned[4].start).toBe(1.5);
    expect(aligned[4].end).toBe(1.9);
  });

  it("كلمة تفريغ لا مقابل لها تبقى كما هي والمحاذاة تستأنف بعدها", () => {
    const written = "يَا لَيْل يَا عِين حَزِين";
    const aligned = alignWordsToLyrics(transcript, written);
    expect(aligned[3].text).toBe("عِين");
    expect(aligned[4].text).toBe("وقلبي"); // بلا مقابل — تبقى بصورة التفريغ
    expect(aligned[5].text).toBe("حَزِين");
  });

  it("نص مكتوب فارغ ⟵ الكلمات كما وصلت", () => {
    expect(alignWordsToLyrics(transcript, "")).toEqual(transcript);
  });
});
