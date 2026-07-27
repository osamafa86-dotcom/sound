import { VOICES } from "./voices";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * ملف الذوق المتعلم — العقل يعرف كل مستخدم من أفعاله لا من إعداداته:
 * أعماله المحفوظة وإشاراته القوية تكشف صوته ولهجته ومقامه المفضل
 * وإعداداته المريحة، فتصبح افتراضات شخصية في الاستوديوهات.
 */

export type TasteProfile = {
  /** أكثر أصوات الكتالوج استخداماً (الأعلى أولاً) */
  topVoices: { voiceId: string; count: number }[];
  /** لهجة الأصوات الغالبة */
  topDialect: string | null;
  topMaqamId: string | null;
  avgStability: number | null;
  avgSpeed: number | null;
  /** حجم الأدلة التي بُني عليها الملف */
  evidence: number;
};

const MIN_EVIDENCE = 3;

export async function getTasteProfile(userId: string): Promise<TasteProfile | null> {
  if (process.env.BRAIN_DISABLED === "1") return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const [gens, sigs] = await Promise.all([
    admin
      .from("generations")
      .select("kind, voice_id, maqam_id, settings")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("signals")
      .select("voice_id, maqam_id, settings, weight")
      .eq("user_id", userId)
      .gte("weight", 1)
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const voiceCounts = new Map<string, number>();
  const maqamCounts = new Map<string, number>();
  const stabilities: number[] = [];
  const speeds: number[] = [];
  let evidence = 0;

  const feed = (
    voiceId: unknown,
    maqamId: unknown,
    settings: Record<string, unknown> | null,
    w: number
  ) => {
    evidence++;
    if (typeof voiceId === "string" && voiceId && !voiceId.startsWith("clone-")) {
      voiceCounts.set(voiceId, (voiceCounts.get(voiceId) ?? 0) + w);
    }
    if (typeof maqamId === "string" && maqamId) {
      maqamCounts.set(maqamId, (maqamCounts.get(maqamId) ?? 0) + w);
    }
    const stability = Number(settings?.stability);
    const speed = Number(settings?.speed);
    if (Number.isFinite(stability)) stabilities.push(stability);
    if (Number.isFinite(speed)) speeds.push(speed);
  };

  for (const g of gens.data ?? []) {
    feed(g.voice_id, g.maqam_id, g.settings as Record<string, unknown> | null, 2); // المحفوظ دليل أقوى
  }
  for (const s of sigs.data ?? []) {
    feed(s.voice_id, s.maqam_id, s.settings as Record<string, unknown> | null, 1);
  }

  if (evidence < MIN_EVIDENCE) return null;

  const topVoices = [...voiceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([voiceId, count]) => ({ voiceId, count }));

  // اللهجة الغالبة من لهجات الأصوات المفضلة
  const dialectCounts = new Map<string, number>();
  for (const { voiceId, count } of topVoices) {
    const dialect = VOICES.find((v) => v.id === voiceId)?.dialect;
    if (dialect) dialectCounts.set(dialect, (dialectCounts.get(dialect) ?? 0) + count);
  }

  const avg = (xs: number[]) =>
    xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null;

  return {
    topVoices,
    topDialect: [...dialectCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    topMaqamId: [...maqamCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
    avgStability: avg(stabilities),
    avgSpeed: avg(speeds),
    evidence,
  };
}
