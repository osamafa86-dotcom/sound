import { describe, expect, it } from "vitest";
import {
  estimateDurationSec,
  joinSections,
  parseSections,
  sanitizeSections,
  sectionIndexAtTime,
  sectionsTotalSec,
  type SongSection,
} from "@/lib/songSections";

describe("بنية الأغنية المُهيكلة", () => {
  it("يقرأ الترويسات العربية: المطلع مقطع مغنّى واللازمة لازمة", () => {
    const sections = parseSections(
      ["مطلع:", "سطر أول", "سطر ثانٍ", "", "لازمة:", "سطر اللازمة", "", "خاتمة:"].join("\n")
    );
    expect(sections.map((s) => s.kind)).toEqual(["verse", "chorus", "outro"]);
    expect(sections[0].lyrics).toContain("سطر أول");
    expect(sections[1].lyrics).toBe("سطر اللازمة");
  });

  it("بلا ترويسات: الكتلة المتكررة تُكتشف لازمةً", () => {
    const chorus = "غنّوا معي واللحن يعلا\nبمقامنا نحلّق";
    const sections = parseSections(["كتلة أولى فريدة", chorus, "كتلة ثالثة فريدة", chorus].join("\n\n"));
    expect(sections.map((s) => s.kind)).toEqual(["verse", "chorus", "verse", "chorus"]);
  });

  it("تقدير المدة: سطر مغنّى ≈ ٧ ثوانٍ ضمن الحدود", () => {
    expect(estimateDurationSec("verse", "س١\nس٢\nس٣\nس٤")).toBe(28);
    expect(estimateDurationSec("intro", "")).toBe(10);
    expect(estimateDurationSec("verse", Array(40).fill("سطر").join("\n"))).toBe(120);
  });

  it("إعادة البناء تتضمن العناوين العربية ويقرؤها التقسيم مجدداً", () => {
    const original = parseSections("مطلع:\nكلمات\n\nلازمة:\nلازمتنا");
    const rebuilt = parseSections(joinSections(original));
    expect(rebuilt.map((s) => s.kind)).toEqual(original.map((s) => s.kind));
  });

  it("التحقيق يرفض الأنواع الغريبة ويقصّ المدد لحدودها", () => {
    expect(sanitizeSections("ليس مصفوفة")).toBeUndefined();
    const clean = sanitizeSections([
      { kind: "chorus", lyrics: "سطر", durationSec: 999 },
      { kind: "hack", lyrics: "تجاهلني", durationSec: 10 },
      { kind: "intro", lyrics: "", durationSec: 1 },
    ]);
    expect(clean).toHaveLength(2);
    expect(clean![0].durationSec).toBe(120);
    expect(clean![1].durationSec).toBe(5);
    expect(sectionsTotalSec(clean!)).toBe(125);
  });

  it("لحظة التشغيل تُنسب لمقطعها بالمدد التراكمية — أساس تصحيح الكلمة المسموعة", () => {
    const sections: SongSection[] = [
      { kind: "intro", lyrics: "", durationSec: 10 },
      { kind: "verse", lyrics: "س", durationSec: 20 },
      { kind: "chorus", lyrics: "ل", durationSec: 15 },
    ];
    expect(sectionIndexAtTime(sections, 0)).toBe(0);
    expect(sectionIndexAtTime(sections, 9.9)).toBe(0);
    expect(sectionIndexAtTime(sections, 10)).toBe(1);
    expect(sectionIndexAtTime(sections, 29.9)).toBe(1);
    expect(sectionIndexAtTime(sections, 30)).toBe(2);
    // بعد نهاية الخط الزمني (انحراف مدة الملف) ⟵ آخر مقطع، وقائمة فارغة ⟵ -1
    expect(sectionIndexAtTime(sections, 60)).toBe(2);
    expect(sectionIndexAtTime([], 5)).toBe(-1);
  });
});
