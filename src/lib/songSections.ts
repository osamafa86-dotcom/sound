/**
 * بنية الأغنية المُهيكلة — مقاطع مسماة بدل نص واحد.
 *
 * المقاطع هي لغة التخاطب بين مساعد الكلمات ومحرر الواجهة ومحرك التوليد:
 * المساعد يقترحها، والمستخدم يعدّلها، وتُترجم لخطة تأليف لدى المحركات الداعمة.
 */

export type SectionKind = "intro" | "verse" | "chorus" | "bridge" | "outro";

export type SongSection = {
  kind: SectionKind;
  /** كلمات المقطع — فارغة للمقاطع الآلية (مقدمة/خاتمة) */
  lyrics: string;
  /** مدة المقطع بالثواني */
  durationSec: number;
};

export const SECTION_LABELS: Record<SectionKind, string> = {
  intro: "مقدمة موسيقية",
  verse: "مقطع",
  chorus: "لازمة",
  bridge: "جسر",
  outro: "خاتمة",
};

/** حدود المقطع الواحد لدى محركات التوليد (Eleven Music: 3–120 ثانية) */
export const SECTION_MIN_SEC = 5;
export const SECTION_MAX_SEC = 120;
export const MAX_SECTIONS = 12;

/** تقدير مدة مقطع من كلماته — سطر عربي مغنّى يستغرق ٦–٨ ثوانٍ تقريباً */
export function estimateDurationSec(kind: SectionKind, lyrics: string): number {
  const lines = lyrics.split("\n").map((l) => l.trim()).filter(Boolean).length;
  if (!lines) return kind === "intro" || kind === "outro" ? 10 : 15;
  const base = lines * 7 + (kind === "chorus" ? 4 : 0);
  return Math.min(SECTION_MAX_SEC, Math.max(SECTION_MIN_SEC, Math.round(base)));
}

export function sectionsTotalSec(sections: SongSection[]): number {
  return sections.reduce((sum, s) => sum + s.durationSec, 0);
}

/**
 * فهرس المقطع الذي تقع فيه لحظة تشغيل — حسب المدد التراكمية.
 * خطة التأليف تفرض مدة كل مقطع لدى المحرك، فالخط الزمني موثوق:
 * به يعرف محرر النص والصوت أي مقطع يعاد إنشاده عند تصحيح كلمة مسموعة.
 */
export function sectionIndexAtTime(sections: SongSection[], sec: number): number {
  if (!sections.length) return -1;
  let acc = 0;
  for (let i = 0; i < sections.length; i++) {
    acc += sections[i].durationSec;
    if (sec < acc) return i;
  }
  // بعد نهاية آخر مقطع (انحراف بسيط في مدة الملف): آخر مقطع
  return sections.length - 1;
}

/** إعادة بناء النص الكامل من المقاطع — للعرض والحفظ وعدّ الكلمات */
export function joinSections(sections: SongSection[]): string {
  return sections
    .map((s) => {
      const header = `${SECTION_LABELS[s.kind]}:`;
      return s.lyrics.trim() ? `${header}\n${s.lyrics.trim()}` : header;
    })
    .join("\n\n");
}

/** تحقيق بنية مقاطع واردة من مصدر خارجي (مساعد/عميل) وتقليمها لحدود المنصة */
export function sanitizeSections(raw: unknown): SongSection[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const kinds: SectionKind[] = ["intro", "verse", "chorus", "bridge", "outro"];
  const out: SongSection[] = [];
  for (const item of raw.slice(0, MAX_SECTIONS)) {
    const o = (item ?? {}) as Record<string, unknown>;
    if (!kinds.includes(o.kind as SectionKind)) continue;
    const kind = o.kind as SectionKind;
    const lyrics = typeof o.lyrics === "string" ? o.lyrics.trim().slice(0, 2000) : "";
    const parsed = Number(o.durationSec);
    out.push({
      kind,
      lyrics,
      durationSec: Number.isFinite(parsed)
        ? Math.min(SECTION_MAX_SEC, Math.max(SECTION_MIN_SEC, Math.round(parsed)))
        : estimateDurationSec(kind, lyrics),
    });
  }
  return out.length ? out : undefined;
}

/** ترويسات المقاطع الشائعة في الكلمات العربية (مع أو بدون أقواس/نقطتين) */
const HEADER_RULES: { pattern: RegExp; kind: SectionKind }[] = [
  { pattern: /^(المقدمة|مقدمة)/, kind: "intro" },
  { pattern: /^(اللازمة|لازمة|الكورس|كورس)/, kind: "chorus" },
  { pattern: /^(الجسر|جسر)/, kind: "bridge" },
  { pattern: /^(الخاتمة|خاتمة|النهاية|نهاية)/, kind: "outro" },
  // «المطلع» في البنية الغنائية العربية هو أول مقطع مغنّى وليس مقدمة آلية
  { pattern: /^(المطلع|مطلع|المقطع|مقطع|الكوبليه|كوبليه)/, kind: "verse" },
];

function headerKind(line: string): SectionKind | null {
  const clean = line.trim().replace(/^[\[(]|[\])]$/g, "").replace(/[:：\d\s]+$/g, "").trim();
  if (clean.length > 20) return null;
  for (const rule of HEADER_RULES) {
    if (rule.pattern.test(clean)) return rule.kind;
  }
  return null;
}

/**
 * تقسيم كلمات حرة إلى مقاطع: يعتمد الترويسات إن وُجدت،
 * وإلا يقسّم على الأسطر الفارغة ويكتشف اللازمة من تكرار المقطع نفسه.
 */
export function parseSections(lyrics: string): SongSection[] {
  const lines = lyrics.split("\n");
  const found: { kind: SectionKind; body: string[] }[] = [];
  let current: { kind: SectionKind; body: string[] } | null = null;
  let sawHeader = false;

  for (const line of lines) {
    const kind = headerKind(line);
    if (kind) {
      sawHeader = true;
      current = { kind, body: [] };
      found.push(current);
    } else if (current) {
      current.body.push(line);
    } else if (line.trim()) {
      current = { kind: "verse", body: [line] };
      found.push(current);
    }
  }

  let sections: SongSection[];
  if (sawHeader) {
    sections = found
      .map((s) => ({ kind: s.kind, lyrics: s.body.join("\n").trim() }))
      .filter((s) => s.lyrics || s.kind === "intro" || s.kind === "outro")
      .map((s) => ({ ...s, durationSec: estimateDurationSec(s.kind, s.lyrics) }));
  } else {
    // بلا ترويسات: كل كتلة (مفصولة بسطر فارغ) مقطع، والكتلة المتكررة حرفياً لازمة
    const blocks = lyrics
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    const counts = new Map<string, number>();
    for (const b of blocks) {
      const key = b.replace(/\s+/g, " ");
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    sections = blocks.map((b) => {
      const kind: SectionKind = (counts.get(b.replace(/\s+/g, " ")) ?? 0) > 1 ? "chorus" : "verse";
      return { kind, lyrics: b, durationSec: estimateDurationSec(kind, b) };
    });
  }

  return sections.slice(0, MAX_SECTIONS);
}
