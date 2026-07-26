import type { SectionKind } from "@/lib/songSections";
import type { MusicRequest } from "./types";

/**
 * مترجم خطة التأليف — من مقاطع المنصة إلى composition_plan لدى Eleven Music:
 * تحكم حقيقي في البنية (المطلع مطلع واللازمة لازمة) بدل برومبت واحد يُفسَّر كيفما اتفق.
 */

export type ElevenSongSection = {
  section_name: string;
  positive_local_styles: string[];
  negative_local_styles: string[];
  duration_ms: number;
  lines: string[];
  /** استيراد المقطع من أغنية سابقة كما هو — أساس إعادة التوليد الجزئي */
  source_from?: { song_id: string; range: { start_ms: number; end_ms: number } };
};

export type ElevenCompositionPlan = {
  positive_global_styles: string[];
  negative_global_styles: string[];
  sections: ElevenSongSection[];
};

/** حدود المحرك: مدة المقطع 3–120 ثانية، و30 سطراً بحد 200 حرف */
const MIN_MS = 3000;
const MAX_MS = 120_000;
const MAX_LINES = 30;
const MAX_LINE_CHARS = 200;

const SECTION_STYLE: Record<
  SectionKind,
  { name: string; positive: string[]; negative: string[] }
> = {
  intro: {
    name: "Intro",
    positive: ["instrumental introduction", "establishes the maqam and mood"],
    negative: ["vocals"],
  },
  verse: {
    name: "Verse",
    positive: ["expressive Arabic verse vocals", "storytelling delivery"],
    negative: [],
  },
  chorus: {
    name: "Chorus",
    positive: ["catchy memorable chorus hook", "fuller layered arrangement"],
    negative: [],
  },
  bridge: {
    name: "Bridge",
    positive: ["contrasting bridge", "stripped-back arrangement building tension"],
    negative: [],
  },
  outro: {
    name: "Outro",
    positive: ["closing section", "gentle resolution, winds down"],
    negative: [],
  },
};

/** يبني خطة التأليف من الطلب — null عندما لا مقاطع (فيبقى مسار البرومبت الواحد) */
export function buildCompositionPlan(req: MusicRequest): ElevenCompositionPlan | null {
  if (!req.sections?.length) return null;
  const instrumental = req.styleId === "instrumental";

  const positive_global_styles = [
    req.stylePrompt,
    ...(req.bpm ? [`${req.bpm} BPM`] : []),
    ...(instrumental
      ? ["instrumental"]
      : req.singer === "male"
        ? ["male Arabic lead vocals"]
        : req.singer === "female"
          ? ["female Arabic lead vocals"]
          : []),
  ].filter(Boolean);

  const negative_global_styles = [
    "low quality",
    "distorted",
    "out of tune",
    ...(instrumental ? ["vocals"] : []),
  ];

  const kindCounts = new Map<SectionKind, number>();
  const totalOfKind = new Map<SectionKind, number>();
  for (const s of req.sections) {
    totalOfKind.set(s.kind, (totalOfKind.get(s.kind) ?? 0) + 1);
  }

  const sections: ElevenSongSection[] = req.sections.map((s) => {
    const style = SECTION_STYLE[s.kind];
    const n = (kindCounts.get(s.kind) ?? 0) + 1;
    kindCounts.set(s.kind, n);
    // ترقيم المقاطع المتكررة من النوع نفسه: Verse 1, Verse 2...
    const name = (totalOfKind.get(s.kind) ?? 1) > 1 ? `${style.name} ${n}` : style.name;

    const lines = instrumental
      ? []
      : s.lyrics
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .slice(0, MAX_LINES)
          .map((l) => l.slice(0, MAX_LINE_CHARS));

    return {
      section_name: name,
      positive_local_styles: style.positive,
      negative_local_styles: style.negative,
      duration_ms: Math.min(MAX_MS, Math.max(MIN_MS, Math.round(s.durationSec * 1000))),
      lines,
    };
  });

  // إعادة توليد جزئي: كل المقاطع تُستورد من الأصل كما هي عدا المقطع المستهدف
  if (
    req.sourceSongId &&
    req.regenerateIndex !== undefined &&
    req.regenerateIndex >= 0 &&
    req.regenerateIndex < sections.length
  ) {
    let cursor = 0;
    sections.forEach((section, i) => {
      const start = cursor;
      cursor += section.duration_ms;
      if (i !== req.regenerateIndex) {
        section.source_from = {
          song_id: req.sourceSongId!,
          range: { start_ms: start, end_ms: cursor },
        };
      }
    });
  }

  return { positive_global_styles, negative_global_styles, sections };
}
