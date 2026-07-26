import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * عقل المنصة — طبقة التعلّم الذاتي فوق المحركات.
 *
 * يتغذى من ثلاثة مصادر تُدمج في إشارات موحدة:
 * 1. نجوم التقييم اليدوية (ratings)
 * 2. الإشارات الضمنية (signals): استماع كامل، حفظ، تنزيل، مشاركة، إعادة توليد...
 * 3. النقد الذاتي (auto_evals): دقة النطق المقيسة آلياً والتزام المقام
 *
 * ويحوّلها إلى ثلاث قدرات:
 * - درجات الأصوات       → ترتيب الكتالوج بالأعلى رضاً
 * - الإعدادات المتعلمة   → أفضل ثبات/سرعة لكل صوت
 * - البرومبتات الناجحة   → أمثلة تُحقن في مساعد الكلمات
 *
 * كل الدوال آمنة التدهور: بلا Supabase أو بلا بيانات تعيد نتائج فارغة،
 * وBRAIN_DISABLED=1 يطفئ كل حلقات التعلم فوراً.
 */

export type VoiceScore = { voiceId: string; count: number; avg: number };
export type VoiceTuning = { stability: number; speed: number; samples: number };
export type PromptExemplar = { maqamId: string | null; stylePrompt: string };

/** الحد الأدنى من التقييمات اليدوية قبل اعتماد الإشارة وحدها */
const MIN_RATINGS = 2;
/** الحد الأدنى من الأدلة المدمجة (نجوم + إشارات + نقد ذاتي) */
const MIN_EVIDENCE = 3;

/** مفتاح الإطفاء الشامل لكل حلقات التعلم */
function brainDisabled(): boolean {
  return process.env.BRAIN_DISABLED === "1";
}

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

/** درجات الأصوات المدموجة من المصادر الثلاثة (بمقياس نجوم 1..5) */
export function getVoiceScores(): Promise<Map<string, VoiceScore>> {
  if (brainDisabled()) return Promise.resolve(new Map());
  return memo("voice-scores", loadVoiceScores);
}

async function loadVoiceScores(): Promise<Map<string, VoiceScore>> {
  const admin = getSupabaseAdmin();
  const scores = new Map<string, VoiceScore>();
  if (!admin) return scores;

  // فشل أي واجهة (مخطط لم يُحدَّث بعد) لا يعطل بقية المصادر
  const [ratings, signals, autos] = await Promise.all([
    admin.from("voice_scores").select("voice_id, ratings_count, avg_score"),
    admin.from("voice_signal_scores").select("voice_id, signals_count, avg_weight"),
    admin.from("voice_auto_scores").select("voice_id, evals_count, avg_auto"),
  ]);

  type Blend = { starSum: number; evidence: number; ratings: number };
  const acc = new Map<string, Blend>();
  const add = (voiceId: unknown, stars: number, count: number, isRating: boolean) => {
    if (typeof voiceId !== "string" || !voiceId || !Number.isFinite(stars) || count <= 0) return;
    const b = acc.get(voiceId) ?? { starSum: 0, evidence: 0, ratings: 0 };
    b.starSum += stars * count;
    b.evidence += count;
    if (isRating) b.ratings += count;
    acc.set(voiceId, b);
  };

  for (const row of ratings.data ?? []) {
    add(row.voice_id, Number(row.avg_score), Number(row.ratings_count), true);
  }
  for (const row of signals.data ?? []) {
    // متوسط وزن الإشارات يتحول نجوماً حول الوسط 3 (مقصوصاً بين 1 و5)
    const stars = Math.min(5, Math.max(1, 3 + Number(row.avg_weight)));
    add(row.voice_id, stars, Math.min(Number(row.signals_count), 30), false);
  }
  for (const row of autos.data ?? []) {
    // دقة النطق الآلية 0..1 → نجوم 1..5
    add(row.voice_id, 1 + Number(row.avg_auto) * 4, Math.min(Number(row.evals_count), 20), false);
  }

  for (const [voiceId, b] of acc) {
    if (b.ratings >= MIN_RATINGS || b.evidence >= MIN_EVIDENCE) {
      scores.set(voiceId, {
        voiceId,
        count: Math.round(b.evidence),
        avg: Math.round((b.starSum / b.evidence) * 10) / 10,
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

type StrongSignalRow = {
  voice_id: string | null;
  maqam_id: string | null;
  settings: Record<string, unknown> | null;
  weight: number;
};

/** إشارات الرضا القوية (حفظ/تنزيل/مشاركة/اختيار نسخة) مع إعداداتها */
async function strongSignals(withVoice: boolean, limit: number): Promise<StrongSignalRow[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("signals")
    .select("voice_id, maqam_id, settings, weight")
    .gte("weight", 2)
    .not(withVoice ? "voice_id" : "maqam_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return error || !data ? [] : (data as StrongSignalRow[]);
}

/** الإعدادات المتعلمة لكل صوت: من التوليدات المُرضية نجوماً وإشاراتٍ معاً */
export function getVoiceTuning(): Promise<Map<string, VoiceTuning>> {
  if (brainDisabled()) return Promise.resolve(new Map());
  return memo("voice-tuning", loadVoiceTuning);
}

async function loadVoiceTuning(): Promise<Map<string, VoiceTuning>> {
  const tuning = new Map<string, VoiceTuning>();
  const [rated, signaled] = await Promise.all([
    highRatedGenerations("tts", 500),
    strongSignals(true, 400),
  ]);

  const acc = new Map<string, { stability: number[]; speed: number[] }>();
  const feed = (voiceId: string | null, settings: Record<string, unknown> | null) => {
    if (!voiceId || !settings) return;
    const stability = Number(settings.stability);
    const speed = Number(settings.speed);
    if (!Number.isFinite(stability) && !Number.isFinite(speed)) return;
    const entry = acc.get(voiceId) ?? { stability: [], speed: [] };
    if (Number.isFinite(stability)) entry.stability.push(stability);
    if (Number.isFinite(speed)) entry.speed.push(speed);
    acc.set(voiceId, entry);
  };

  for (const row of rated) feed(row.generations?.voice_id ?? null, row.generations?.settings ?? null);
  for (const row of signaled) {
    feed(row.voice_id as string | null, row.settings as Record<string, unknown> | null);
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

/** البرومبتات الموسيقية الناجحة — من أعلى التقييمات وأقوى الإشارات */
export function getPromptExemplars(max = 3): Promise<PromptExemplar[]> {
  if (brainDisabled()) return Promise.resolve([]);
  return memo(`exemplars-${max}`, () => loadPromptExemplars(max));
}

async function loadPromptExemplars(max: number): Promise<PromptExemplar[]> {
  const [rated, signaled] = await Promise.all([
    highRatedGenerations("song", 40),
    strongSignals(false, 60),
  ]);

  const seen = new Set<string>();
  const exemplars: PromptExemplar[] = [];
  const push = (maqamId: string | null, raw: unknown) => {
    const stylePrompt = typeof raw === "string" ? raw : "";
    if (!stylePrompt || seen.has(stylePrompt) || exemplars.length >= max) return;
    seen.add(stylePrompt);
    exemplars.push({ maqamId, stylePrompt: stylePrompt.slice(0, 400) });
  };

  // النجوم اليدوية أقوى دليلاً فتتقدم، والإشارات الضمنية تكمل النقص
  for (const row of rated) {
    push(row.generations?.maqam_id ?? null, row.generations?.settings?.stylePrompt);
  }
  for (const row of signaled) {
    push(
      (row.maqam_id as string | null) ?? null,
      (row.settings as Record<string, unknown> | null)?.stylePrompt
    );
  }
  return exemplars;
}
