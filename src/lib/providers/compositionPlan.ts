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

const SECTION_EN: Record<SectionKind, string> = {
  intro: "Intro",
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
};

/** طلب آلي: أسلوب آلي صريح، أو لا كلمات في النص الحر ولا في المقاطع */
export function isInstrumentalRequest(req: MusicRequest): boolean {
  const hasSectionLyrics = !!req.sections?.some((s) => s.lyrics.trim());
  return req.styleId === "instrumental" || (!req.lyrics?.trim() && !hasSectionLyrics);
}

/**
 * برومبت Music v2 — النموذج الأحدث يفهم البنية والكلمات داخل النص مباشرة
 * (خطة التأليف المهيكلة بقيت لغة v1، وv2 يتجاهل فرض المدد أصلاً):
 * ترويسة الأسلوب ثم المقاطع بعناوينها ومددها التقريبية وكلماتها كما كُتبت.
 */
export function buildElevenMusicPrompt(req: MusicRequest): string {
  const instrumentalOnly = isInstrumentalRequest(req);

  const header = [
    req.stylePrompt,
    ...(req.bpm ? [`${req.bpm} BPM`] : []),
    ...(req.singer && !instrumentalOnly ? [`${req.singer} Arabic lead vocals`] : []),
    ...(req.dialectEn && !instrumentalOnly
      ? [`authentic ${req.dialectEn}, native-speaker pronunciation`]
      : []),
  ];

  if (instrumentalOnly) {
    return [...header, "instrumental only, no vocals"].join("\n");
  }

  if (req.sections?.length) {
    const counts = new Map<SectionKind, number>();
    const body = req.sections
      .map((s) => {
        const n = (counts.get(s.kind) ?? 0) + 1;
        counts.set(s.kind, n);
        const label = `[${SECTION_EN[s.kind]} ${n} — ~${s.durationSec}s]`;
        return s.kind === "intro" || s.kind === "outro" || !s.lyrics.trim()
          ? `${label} (instrumental)`
          : `${label}\n${s.lyrics.trim()}`;
      })
      .join("\n\n");
    return [
      ...header,
      "Sing the lyrics exactly as written including diacritics. Do not improvise, add, replace, or skip any words.",
      "Song structure with lyrics:",
      body,
    ].join("\n");
  }

  return [
    ...header,
    `Arabic vocals singing these lyrics exactly as written:\n${req.lyrics!.trim()}`,
  ].join("\n");
}

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
    // لهجة الأداء: نطق أصيل كالمتحدث الأصلي، والكلمات تُغنى كما كُتبت بتشكيلها
    ...(!instrumental && req.dialectEn
      ? [
          `authentic ${req.dialectEn} vocals, native-speaker pronunciation`,
          "sing the lyrics exactly as written including diacritics",
        ]
      : []),
  ].filter(Boolean);

  const negative_global_styles = [
    "low quality",
    "distorted",
    "out of tune",
    // الكلمات مقدسة: لا ارتجال ولا استبدال — أعلى شكوى جودة عربية
    ...(instrumental ? ["vocals"] : ["improvised or altered lyrics", "mumbled words"]),
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
