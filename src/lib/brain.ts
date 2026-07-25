import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * عقل المنصة — طبقة التعلّم الذاتي فوق المحركات.
 *
 * تقرأ تقييمات المستخدمين (نجوم المكتبة) وتحوّلها إلى ثلاث إشارات:
 * 1. درجات الأصوات       → ترتيب الكتالوج بالأعلى رضاً
 * 2. الإعدادات المتعلمة   → أفضل ثبات/سرعة لكل صوت من التوليدات عالية التقييم
 * 3. البرومبتات الناجحة   → أمثلة تُحقن في مساعد الكلمات ليحتذي بها
 *
 * كل الدوال آمنة التدهور: بلا Supabase أو بلا بيانات تعيد نتائج فارغة.
 */

export type VoiceScore = { voiceId: string; count: number; avg: number };
export type VoiceTuning = { stability: number; speed: number; samples: number };
export type PromptExemplar = { maqamId: string | null; stylePrompt: string };

/** الحد الأدنى من التقييمات قبل اعتماد الإشارة (يمنع تحيّز التقييم الواحد) */
const MIN_RATINGS = 2;

/** كاش قصير العمر — يوفّر قراءات القاعدة على النسخ الدافئة في Serverless */
const TTL_MS = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
async function memo<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  return value;
}

/** درجات الأصوات من واجهة voice_scores (متوسط نجوم كل صوت) */
export function getVoiceScores(): Promise<Map<string, VoiceScore>> {
  return memo("voice-scores", loadVoiceScores);
}

async function loadVoiceScores(): Promise<Map<string, VoiceScore>> {
  const admin = getSupabaseAdmin();
  const scores = new Map<string, VoiceScore>();
  if (!admin) return scores;

  const { data, error } = await admin
    .from("voice_scores")
    .select("voice_id, ratings_count, avg_score");
  if (error || !data) return scores;

  for (const row of data) {
    if (row.voice_id && row.ratings_count >= MIN_RATINGS) {
      scores.set(row.voice_id as string, {
        voiceId: row.voice_id as string,
        count: row.ratings_count as number,
        avg: Number(row.avg_score),
      });
    }
  }
  return scores;
}

type RatedGeneration = {
  score: number;
  generations: {
    kind: string;
    voice_id: string | null;
    maqam_id: string | null;
    settings: Record<string, unknown> | null;
  } | null;
};

/** التوليدات عالية التقييم (4★ فأعلى) مع إعداداتها — وقود الضبط الذاتي والأمثلة */
async function highRatedGenerations(kind: "tts" | "song", limit: number): Promise<RatedGeneration[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];

  const { data, error } = await admin
    .from("ratings")
    .select("score, generations!inner(kind, voice_id, maqam_id, settings)")
    .gte("score", 4)
    .eq("generations.kind", kind)
    .order("score", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as unknown as RatedGeneration[];
}

/** الإعدادات المتعلمة لكل صوت: متوسط ثبات/سرعة التوليدات التي أرضت المستخدمين */
export function getVoiceTuning(): Promise<Map<string, VoiceTuning>> {
  return memo("voice-tuning", loadVoiceTuning);
}

async function loadVoiceTuning(): Promise<Map<string, VoiceTuning>> {
  const tuning = new Map<string, VoiceTuning>();
  const rows = await highRatedGenerations("tts", 500);

  const acc = new Map<string, { stability: number[]; speed: number[] }>();
  for (const row of rows) {
    const g = row.generations;
    if (!g?.voice_id || !g.settings) continue;
    const stability = Number(g.settings.stability);
    const speed = Number(g.settings.speed);
    if (!Number.isFinite(stability) && !Number.isFinite(speed)) continue;
    const entry = acc.get(g.voice_id) ?? { stability: [], speed: [] };
    if (Number.isFinite(stability)) entry.stability.push(stability);
    if (Number.isFinite(speed)) entry.speed.push(speed);
    acc.set(g.voice_id, entry);
  }

  for (const [voiceId, { stability, speed }] of acc) {
    const samples = Math.max(stability.length, speed.length);
    if (samples < MIN_RATINGS) continue;
    const avg = (xs: number[], fallback: number) =>
      xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : fallback;
    tuning.set(voiceId, {
      stability: avg(stability, 0.5),
      speed: avg(speed, 1),
      samples,
    });
  }
  return tuning;
}

/** البرومبتات الموسيقية التي أنتجت أغاني عالية التقييم — أمثلة لمساعد الكلمات */
export function getPromptExemplars(max = 3): Promise<PromptExemplar[]> {
  return memo(`exemplars-${max}`, () => loadPromptExemplars(max));
}

async function loadPromptExemplars(max: number): Promise<PromptExemplar[]> {
  const rows = await highRatedGenerations("song", 40);

  const seen = new Set<string>();
  const exemplars: PromptExemplar[] = [];
  for (const row of rows) {
    const g = row.generations;
    const stylePrompt = typeof g?.settings?.stylePrompt === "string" ? g.settings.stylePrompt : "";
    if (!stylePrompt || seen.has(stylePrompt)) continue;
    seen.add(stylePrompt);
    exemplars.push({ maqamId: g?.maqam_id ?? null, stylePrompt: stylePrompt.slice(0, 400) });
    if (exemplars.length >= max) break;
  }
  return exemplars;
}
