import { describe, expect, it } from "vitest";
import {
  alignWordsToLyrics,
  buildLrc,
  buildSrt,
  findActiveWord,
  groupWords,
  measureSectionStarts,
  sectionIndexFromStarts,
  type KaraokeWord,
} from "@/lib/karaoke";
import type { SongSection } from "@/lib/songSections";

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

  it("كلمة تفريغ لا مقابل لها تبقى كما هي مع علم عدم المطابقة — كاشف الانحراف", () => {
    const written = "يَا لَيْل يَا عِين حَزِين";
    const aligned = alignWordsToLyrics(transcript, written);
    expect(aligned[3].text).toBe("عِين");
    expect(aligned[3].matched).toBe(true);
    expect(aligned[4].text).toBe("وقلبي"); // بلا مقابل — تبقى بصورة التفريغ
    expect(aligned[4].matched).toBe(false);
    expect(aligned[5].text).toBe("حَزِين");
    expect(aligned[5].matched).toBe(true);
  });

  it("نص مكتوب فارغ ⟵ الكلمات كما وصلت", () => {
    expect(alignWordsToLyrics(transcript, "")).toEqual(transcript);
  });

  it("سطر مكتوب كامل أسقطه الغناء لا يُفقد ما بعده — المحاذاة المثلى تستعيد التزامن", () => {
    // النافذة الجشعة القديمة كانت تعلق هنا فتحكم زوراً على كل الباقي بعدم المطابقة
    const sung: KaraokeWord[] = [
      { text: "يا", start: 0, end: 0.3 },
      { text: "ليل", start: 0.4, end: 0.8 },
      { text: "غنوا", start: 5, end: 5.4 },
      { text: "معي", start: 5.5, end: 5.9 },
    ];
    const written = "يَا لَيْل سَطْرٌ طَوِيلٌ مَحْذُوفٌ تَمَامًا مِنَ الغِنَاء هُنَا غَنُّوا مَعِي";
    const aligned = alignWordsToLyrics(sung, written);
    expect(aligned.map((w) => w.matched)).toEqual([true, true, true, true]);
    expect(aligned[2].text).toBe("غَنُّوا");
    expect(aligned[3].text).toBe("مَعِي");
  });
});

describe("قياس بدايات المقاطع من التفريغ الموقوت", () => {
  const sungWords: KaraokeWord[] = [
    { text: "يا", start: 12, end: 12.4 },
    { text: "ليل", start: 12.5, end: 13 },
    { text: "يا", start: 13.1, end: 13.4 },
    { text: "عين", start: 13.5, end: 14 },
    { text: "غنوا", start: 30, end: 30.5 },
    { text: "معي", start: 30.6, end: 31 },
  ];
  const sections: SongSection[] = [
    { kind: "intro", lyrics: "", durationSec: 10 },
    { kind: "verse", lyrics: "يَا لَيْل يَا عِين", durationSec: 20 },
    { kind: "chorus", lyrics: "غَنُّوا مَعِي", durationSec: 15 },
  ];

  it("البدايات الحقيقية من مطابقة الكلمات — لا من المدد المخططة", () => {
    const starts = measureSectionStarts(sungWords, sections)!;
    expect(starts).toEqual([0, 12, 30]);
    // الخريطة: قبل ١٢ مقدمة، وبعد ٣٠ لازمة — رغم أن الخطة تقول اللازمة تبدأ عند ٣٠=١٠+٢٠
    expect(sectionIndexFromStarts(starts, 5)).toBe(0);
    expect(sectionIndexFromStarts(starts, 13)).toBe(1);
    expect(sectionIndexFromStarts(starts, 45)).toBe(2);
  });

  it("مقطع لم يُطابَق يُقدَّر من جاره ومدته المخططة دون كسر الرتابة", () => {
    const other: SongSection[] = [
      { kind: "verse", lyrics: "يَا لَيْل يَا عِين", durationSec: 20 },
      { kind: "bridge", lyrics: "كلمات مختلفة تماماً هنا", durationSec: 10 },
      { kind: "chorus", lyrics: "غَنُّوا مَعِي", durationSec: 15 },
    ];
    const starts = measureSectionStarts(sungWords, other)!;
    expect(starts[0]).toBe(12);
    expect(starts[1]).toBeGreaterThanOrEqual(12);
    expect(starts[1]).toBeLessThanOrEqual(30);
    expect(starts[2]).toBe(30);
  });

  it("تفريغ بلا أي مطابقة ⟵ null (لا ثقة بالقياس)", () => {
    expect(
      measureSectionStarts(sungWords, [
        { kind: "verse", lyrics: "نص آخر كلياً بلا تقاطع", durationSec: 30 },
      ])
    ).toBeNull();
  });
});
