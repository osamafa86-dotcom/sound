import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { LIMITS } from "@/lib/rateLimit";
import {
  aggregateUsage,
  countBy,
  parseLimitWindows,
  type LimitWindow,
  type UsageAggregate,
  type UsageRow,
} from "./aggregate";

/**
 * قراءات لوحة المالك من قاعدة البيانات — كلها بمفتاح الخدمة (تتجاوز RLS)
 * وخلف حارس requireOwner في المسارات. كل دالة تعيد `configured: false`
 * بدل الانهيار عندما تكون Supabase غير مهيأة (التطوير المحلي).
 */

const MAX_ROWS = 20_000;

export type Configured<T> = ({ configured: true } & T) | { configured: false };

function notConfigured(): { configured: false } {
  return { configured: false };
}

/* ----------------------------- الاستهلاك ----------------------------- */

export async function getUsageStats(days: number): Promise<Configured<{ days: number } & UsageAggregate>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await admin
    .from("usage_events")
    .select("route, cost, user_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error) {
    console.error("admin usage query failed:", error.message);
    return notConfigured();
  }

  return { configured: true, days, ...aggregateUsage((data ?? []) as UsageRow[], days) };
}

/* ------------------------- المحتوى والمخرجات ------------------------- */

export type ContentStats = {
  generations: { total: number; byKind: Record<string, number>; byProvider: Record<string, number> };
  ratings: { count: number; average: number | null; distribution: Record<string, number> };
  jobs: { total: number; byStatus: Record<string, number>; recentFailures: { id: string; error: string; createdAt: string }[] };
  customVoices: number;
  users: { total: number; newLast7Days: number };
};

export async function getContentStats(): Promise<Configured<ContentStats>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

  const [gens, rates, jobs, voices, profiles, newProfiles] = await Promise.all([
    admin.from("generations").select("kind, provider").limit(MAX_ROWS),
    admin.from("ratings").select("score").limit(MAX_ROWS),
    admin.from("song_jobs").select("id, status, error, created_at").order("created_at", { ascending: false }).limit(500),
    admin.from("custom_voices").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }),
    admin.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
  ]);

  const genRows = (gens.data ?? []) as { kind: string; provider: string | null }[];
  const rateRows = (rates.data ?? []) as { score: number }[];
  const jobRows = (jobs.data ?? []) as { id: string; status: string; error: string | null; created_at: string }[];

  const average = rateRows.length
    ? Math.round((rateRows.reduce((s, r) => s + r.score, 0) / rateRows.length) * 100) / 100
    : null;

  return {
    configured: true,
    generations: {
      total: genRows.length,
      byKind: countBy(genRows, (g) => g.kind),
      byProvider: countBy(genRows, (g) => g.provider),
    },
    ratings: {
      count: rateRows.length,
      average,
      distribution: countBy(rateRows, (r) => String(r.score)),
    },
    jobs: {
      total: jobRows.length,
      byStatus: countBy(jobRows, (j) => j.status),
      recentFailures: jobRows
        .filter((j) => j.status === "failed")
        .slice(0, 10)
        .map((j) => ({ id: j.id, error: j.error ?? "بلا تفصيل", createdAt: j.created_at })),
    },
    customVoices: voices.count ?? 0,
    users: { total: profiles.count ?? 0, newLast7Days: newProfiles.count ?? 0 },
  };
}

/* ------------------------------ المستخدمون ------------------------------ */

export type AdminUser = {
  id: string;
  email: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
  credits: number | null;
  displayName: string | null;
  generations: number;
  /** أحداث الاستهلاك خلال آخر ٣٠ يوماً */
  usage30d: number;
  isOwner: boolean;
};

export async function getUsers(
  page: number,
  perPage: number,
  isOwnerEmail: (email: string | null) => boolean
): Promise<Configured<{ users: AdminUser[]; page: number; perPage: number; hasMore: boolean }>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  const size = Math.min(Math.max(perPage, 1), 100);
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: size });
  if (error) {
    console.error("admin listUsers failed:", error.message);
    return notConfigured();
  }

  const ids = data.users.map((u) => u.id);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [profiles, gens, usage] = await Promise.all([
    admin.from("profiles").select("id, display_name, credits").in("id", ids),
    admin.from("generations").select("user_id").in("user_id", ids).limit(MAX_ROWS),
    admin.from("usage_events").select("user_id, cost").in("user_id", ids).gte("created_at", since).limit(MAX_ROWS),
  ]);

  const profileById = new Map(
    ((profiles.data ?? []) as { id: string; display_name: string | null; credits: number | null }[]).map((p) => [p.id, p])
  );
  const genCount = countBy((gens.data ?? []) as { user_id: string }[], (g) => g.user_id);
  const usageCount: Record<string, number> = {};
  for (const row of (usage.data ?? []) as { user_id: string; cost: number | null }[]) {
    usageCount[row.user_id] = (usageCount[row.user_id] ?? 0) + (Number(row.cost) || 1);
  }

  return {
    configured: true,
    page,
    perPage: size,
    hasMore: data.users.length === size,
    users: data.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      confirmed: !!u.email_confirmed_at,
      credits: profileById.get(u.id)?.credits ?? null,
      displayName: profileById.get(u.id)?.display_name ?? null,
      generations: genCount[u.id] ?? 0,
      usage30d: usageCount[u.id] ?? 0,
      isOwner: isOwnerEmail(u.email ?? null),
    })),
  };
}

/** تعديل رصيد مستخدم — القيمة المطلقة الجديدة، لا فرقاً */
export async function setUserCredits(userId: string, credits: number): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("قاعدة البيانات غير مهيأة");
  const { error } = await admin.from("profiles").update({ credits }).eq("id", userId);
  if (error) throw new Error(`تعذّر تحديث الرصيد: ${error.message}`);
}

/* -------------------------------- المهام -------------------------------- */

export type AdminJob = {
  id: string;
  status: string;
  stage: string;
  tier: string;
  provider: string | null;
  mock: boolean;
  fellBack: string | null;
  error: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

export async function getJobs(limit: number, status?: string): Promise<Configured<{ jobs: AdminJob[] }>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  let query = admin
    .from("song_jobs")
    .select("id, status, stage, tier, provider, mock, fell_back, error, user_id, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 200));
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("admin jobs query failed:", error.message);
    return notConfigured();
  }

  type Row = {
    id: string; status: string; stage: string; tier: string; provider: string | null;
    mock: boolean; fell_back: string | null; error: string | null; user_id: string | null;
    created_at: string; updated_at: string;
  };

  return {
    configured: true,
    jobs: ((data ?? []) as Row[]).map((j) => ({
      id: j.id,
      status: j.status,
      stage: j.stage,
      tier: j.tier,
      provider: j.provider,
      mock: j.mock,
      fellBack: j.fell_back,
      error: j.error,
      userId: j.user_id,
      createdAt: j.created_at,
      updatedAt: j.updated_at,
    })),
  };
}

/**
 * حذف المهام الأقدم من عدد أيام — تنظيف يدوي من اللوحة.
 * يحذف ملفات الصوت من حاوية jobs أولاً حتى لا يبقى تخزين يتيم بلا صفوف.
 */
export async function purgeJobs(olderThanDays: number): Promise<number> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("قاعدة البيانات غير مهيأة");
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();

  const { data: doomed, error: readErr } = await admin
    .from("song_jobs")
    .select("id, audio_path")
    .lt("created_at", cutoff)
    .limit(1000);
  if (readErr) throw new Error(`تعذّر التنظيف: ${readErr.message}`);
  if (!doomed?.length) return 0;

  const paths = (doomed as { audio_path: string | null }[])
    .map((j) => j.audio_path)
    .filter((p): p is string => !!p);
  if (paths.length) {
    const { error: storageErr } = await admin.storage.from("jobs").remove(paths);
    // فشل حذف الملفات لا يمنع حذف الصفوف — يُسجَّل فقط
    if (storageErr) console.error("job audio cleanup failed:", storageErr.message);
  }

  const ids = (doomed as { id: string }[]).map((j) => j.id);
  const { error } = await admin.from("song_jobs").delete().in("id", ids);
  if (error) throw new Error(`تعذّر التنظيف: ${error.message}`);
  return ids.length;
}

/* ------------------------------- الحدود ------------------------------- */

export async function getLimitWindows(): Promise<Configured<{ windows: LimitWindow[] }>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  const { data, error } = await admin
    .from("rate_limits")
    .select("key, window_start, count")
    .order("count", { ascending: false })
    .limit(200);

  if (error) {
    console.error("admin limits query failed:", error.message);
    return notConfigured();
  }

  const windowSecFor = (scope: string) =>
    (LIMITS as Record<string, { windowSec: number }>)[scope]?.windowSec ?? 3600;

  return { configured: true, windows: parseLimitWindows(data ?? [], windowSecFor) };
}

/** تصفير نافذة حد بعينها — لفك حظر مستخدم عالق */
export async function resetLimitWindow(key: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("قاعدة البيانات غير مهيأة");
  const { error } = await admin.from("rate_limits").delete().eq("key", key);
  if (error) throw new Error(`تعذّر التصفير: ${error.message}`);
}

/* ---------------------------- الأصوات المخصصة ---------------------------- */

export type AdminCustomVoice = { id: string; name: string; userId: string | null; createdAt: string };

export async function getCustomVoices(limit = 100): Promise<Configured<{ voices: AdminCustomVoice[] }>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  const { data, error } = await admin
    .from("custom_voices")
    .select("id, name, user_id, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));

  if (error) {
    console.error("admin voices query failed:", error.message);
    return notConfigured();
  }

  type Row = { id: string; name: string; user_id: string | null; created_at: string };
  return {
    configured: true,
    voices: ((data ?? []) as Row[]).map((v) => ({
      id: v.id,
      name: v.name,
      userId: v.user_id,
      createdAt: v.created_at,
    })),
  };
}

/* ------------------------------ سجل التدقيق ------------------------------ */

export type AuditEntry = {
  id: number;
  actorEmail: string;
  action: string;
  target: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export async function getAuditLog(limit = 50): Promise<Configured<{ entries: AuditEntry[] }>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  const { data, error } = await admin
    .from("admin_audit")
    .select("id, actor_email, action, target, details, created_at")
    .order("created_at", { ascending: false })
    .limit(Math.min(limit, 200));

  if (error) {
    console.error("admin audit query failed:", error.message);
    return notConfigured();
  }

  type Row = {
    id: number; actor_email: string; action: string; target: string | null;
    details: Record<string, unknown> | null; created_at: string;
  };
  return {
    configured: true,
    entries: ((data ?? []) as Row[]).map((e) => ({
      id: e.id,
      actorEmail: e.actor_email,
      action: e.action,
      target: e.target,
      details: e.details ?? {},
      createdAt: e.created_at,
    })),
  };
}

/** ترتيب الأصوات حسب التقييم — يقرأ العرض الجاهز voice_scores */
export async function getVoiceScores(): Promise<Configured<{ scores: { voiceId: string; count: number; average: number }[] }>> {
  const admin = getSupabaseAdmin();
  if (!admin) return notConfigured();

  const { data, error } = await admin
    .from("voice_scores")
    .select("voice_id, ratings_count, avg_score")
    .order("avg_score", { ascending: false })
    .limit(50);

  if (error) {
    console.error("admin voice scores query failed:", error.message);
    return notConfigured();
  }

  type Row = { voice_id: string; ratings_count: number; avg_score: number };
  return {
    configured: true,
    scores: ((data ?? []) as Row[]).map((s) => ({
      voiceId: s.voice_id,
      count: s.ratings_count,
      average: Number(s.avg_score),
    })),
  };
}
