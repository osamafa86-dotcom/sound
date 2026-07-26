import { describe, expect, it } from "vitest";
import { buildCompositionPlan } from "@/lib/providers/compositionPlan";
import type { MusicRequest } from "@/lib/providers/types";

const base: MusicRequest = {
  maqamId: "hijaz",
  styleId: "tarab",
  instrumentIds: ["oud"],
  stylePrompt: "Arabic maqam Hijaz, oud and qanun",
};

describe("مترجم خطة التأليف (Eleven Music)", () => {
  it("بلا مقاطع: لا خطة (يبقى مسار البرومبت الواحد)", () => {
    expect(buildCompositionPlan(base)).toBeNull();
  });

  it("يبني الخطة: ترقيم المقاطع المتكررة وتقسيم الأسطر وقص المدد", () => {
    const plan = buildCompositionPlan({
      ...base,
      singer: "female",
      bpm: 96,
      sections: [
        { kind: "intro", lyrics: "", durationSec: 10 },
        { kind: "verse", lyrics: "سطر أول\nسطر ثانٍ", durationSec: 30 },
        { kind: "chorus", lyrics: "لازمة", durationSec: 20 },
        { kind: "verse", lyrics: "مقطع ثانٍ", durationSec: 1 },
      ],
    })!;

    expect(plan.positive_global_styles).toContain("Arabic maqam Hijaz, oud and qanun");
    expect(plan.positive_global_styles).toContain("96 BPM");
    expect(plan.positive_global_styles).toContain("female Arabic lead vocals");

    expect(plan.sections.map((s) => s.section_name)).toEqual(["Intro", "Verse 1", "Chorus", "Verse 2"]);
    expect(plan.sections[0].lines).toEqual([]);
    expect(plan.sections[0].negative_local_styles).toContain("vocals");
    expect(plan.sections[1].lines).toEqual(["سطر أول", "سطر ثانٍ"]);
    expect(plan.sections[1].duration_ms).toBe(30_000);
    expect(plan.sections[3].duration_ms).toBe(3000);
  });

  it("إعادة التوليد الجزئي: كل المقاطع تُستورد من الأصل بمداها الزمني عدا المستهدف", () => {
    const plan = buildCompositionPlan({
      ...base,
      sourceSongId: "song_abc123",
      regenerateIndex: 1,
      sections: [
        { kind: "intro", lyrics: "", durationSec: 10 },
        { kind: "chorus", lyrics: "لازمة جديدة", durationSec: 20 },
        { kind: "outro", lyrics: "", durationSec: 10 },
      ],
    })!;

    expect(plan.sections[0].source_from).toEqual({
      song_id: "song_abc123",
      range: { start_ms: 0, end_ms: 10_000 },
    });
    expect(plan.sections[1].source_from).toBeUndefined();
    expect(plan.sections[2].source_from).toEqual({
      song_id: "song_abc123",
      range: { start_ms: 30_000, end_ms: 40_000 },
    });
  });

  it("الموسيقى الآلية: بلا أسطر غنائية وvocals ضمن السلبيات العامة", () => {
    const plan = buildCompositionPlan({
      ...base,
      styleId: "instrumental",
      sections: [{ kind: "verse", lyrics: "كلمات تُتجاهل", durationSec: 30 }],
    })!;
    expect(plan.sections[0].lines).toEqual([]);
    expect(plan.negative_global_styles).toContain("vocals");
  });
});
