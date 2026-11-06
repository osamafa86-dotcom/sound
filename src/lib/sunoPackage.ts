import { DIALECTS, INSTRUMENTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { heritageDeliveryEn, heritageStyle } from "@/lib/heritage/palestinian";
import type { SectionKind, SongSection } from "@/lib/songSections";

/**
 * حزمة Suno — مقام العقل وSuno الحنجرة:
 * مقام يجهّز كل ما يحتاجه وضع Custom في Suno (كلمات مشكّلة بعلامات
 * المقاطع، وبرومبت أسلوب محسوب للمقام واللهجة والآلات، وعنوان، وما يُستبعد)
 * فينسخه المستخدم إلى حسابه هناك. لا أتمتة لحساب Suno — تحكّم بشري كامل.
 */

/** حدود حقول وضع Custom في Suno (v4.5 فأحدث) */
export const SUNO_LIMITS = { lyrics: 5000, style: 1000, title: 80, exclude: 1000 } as const;

export const SUNO_CREATE_URL = "https://suno.com/create";

const TAG: Record<SectionKind, string> = {
  intro: "Intro",
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
};

/**
 * الكلمات بعلامات Suno الوصفية — المقاطع المتكررة تُرقَّم (Verse 1/2)
 * والمقاطع الآلية الفارغة تُعلَّم [Instrumental] كي يتركها المحرك للعزف.
 */
export function sunoLyrics(sections: SongSection[]): string {
  const counts: Partial<Record<SectionKind, number>> = {};
  const totals: Partial<Record<SectionKind, number>> = {};
  for (const s of sections) totals[s.kind] = (totals[s.kind] ?? 0) + 1;

  const blocks = sections.map((s) => {
    counts[s.kind] = (counts[s.kind] ?? 0) + 1;
    const numbered = s.kind === "verse" && (totals.verse ?? 0) > 1;
    const tag = `[${TAG[s.kind]}${numbered ? ` ${counts[s.kind]}` : ""}]`;
    const body = s.lyrics.trim();
    return body ? `${tag}\n${body}` : `${tag}\n[Instrumental]`;
  });

  return blocks.join("\n\n").slice(0, SUNO_LIMITS.lyrics);
}

/** قصّ عند حدود الفاصلة لا في منتصف وصف */
export function trimAtComma(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const at = cut.lastIndexOf(",");
  return (at > max * 0.6 ? cut.slice(0, at) : cut).trim();
}

export type SunoStyleInput = {
  maqamId: string;
  styleId: string;
  dialectId?: string;
  singer?: "male" | "female";
  instrumentIds?: string[];
};

/**
 * برومبت الأسلوب: Suno يعطي الأولوية لأول الوصف — فيتقدم النوع والصوت
 * واللغة، ثم روح المقام، ثم الآلات والتراث. بالإنجليزية لأنها لغة فهمه الأدق.
 */
export function sunoStyle(input: SunoStyleInput): string {
  const maqam = MAQAMAT.find((m) => m.id === input.maqamId) ?? MAQAMAT[0];
  const style = SONG_STYLES.find((s) => s.id === input.styleId);
  const dialect = DIALECTS.find((d) => d.id === input.dialectId);
  const instruments = INSTRUMENTS.filter((i) => input.instrumentIds?.includes(i.id)).map(
    (i) => i.en
  );
  const heritage = heritageStyle(input.styleId);
  const delivery = heritageDeliveryEn(input.dialectId, input.styleId);

  const parts = [
    style?.en,
    input.singer ? `${input.singer} Arabic vocals` : "Arabic vocals",
    dialect ? `sung in ${dialect.en}` : "",
    "clear Arabic diction",
    maqam.stylePrompt,
    instruments.length ? instruments.join(", ") : "",
    heritage?.dna,
    delivery,
  ]
    .map((p) => (p ?? "").trim().replace(/\.$/, ""))
    .filter(Boolean);

  return trimAtComma(parts.join(", ").replace(/\s{2,}/g, " "), SUNO_LIMITS.style);
}

/** ما يُستبعد من الأسلوب — يحمي الطابع الشرقي من الانجراف الغربي */
export const SUNO_EXCLUDE = "English lyrics, autotune, western pop vocals, rap, EDM drop";

/** عنوان من المستخدم أو من أول سطر في اللازمة/المقطع الأول */
export function sunoTitle(sections: SongSection[], explicit?: string): string {
  const own = explicit?.trim();
  if (own) return own.slice(0, SUNO_LIMITS.title);
  const source =
    sections.find((s) => s.kind === "chorus" && s.lyrics.trim()) ??
    sections.find((s) => s.lyrics.trim());
  const firstLine = source?.lyrics.trim().split("\n")[0] ?? "";
  // بلا حركات في العنوان — أنظف للعرض في مكتبة Suno
  return firstLine.replace(/[ً-ْٰ]/g, "").slice(0, SUNO_LIMITS.title) || "أغنية من مقام";
}

export type SunoPackage = {
  title: string;
  lyrics: string;
  style: string;
  exclude: string;
};
