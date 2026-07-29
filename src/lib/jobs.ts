import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { AudioResult, MusicRequest } from "./providers/types";

/**
 * نظام المهام الطويلة — توليد الأغنية يستغرق وقتاً، فتُنشأ مهمة ويستعلم
 * العميل عن حالتها دورياً بدل انتظار طلب HTTP واحد طويل.
 *
 * مخزنان خلف واجهة واحدة:
 * - Supabase (جدول song_jobs + حاوية jobs): الوضع الدائم للإنتاج على Vercel،
 *   حيث لا تتشارك نسخ الخادم Serverless أي ذاكرة.
 * - الذاكرة: بيئة التطوير أو عند غياب مفتاح الخدمة.
 */

export type GenerationTier = "preview" | "full";
export type JobStatus = "pending" | "running" | "done" | "failed";

export type SongJob = {
  id: string;
  status: JobStatus;
  /** وصف المرحلة الحالية بالعربية للعرض في الواجهة */
  stage: string;
  tier: GenerationTier;
  userId: string | null;
  request: MusicRequest;
  provider?: string;
  mimeType?: string;
  mock?: boolean;
  /** سبب الرجوع للوضع التجريبي إن حدث */
  fellBack?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

export type JobPatch = Partial<
  Pick<SongJob, "status" | "stage" | "provider" | "mimeType" | "mock" | "fellBack" | "error">
>;

export interface JobsStore {
  readonly id: "memory" | "supabase";
  create(tier: GenerationTier, request: MusicRequest, userId?: string | null): Promise<SongJob>;
  get(id: string): Promise<SongJob | undefined>;
  update(id: string, patch: JobPatch): Promise<void>;
  /** يخزّن الناتج الصوتي ويعلّم المهمة مكتملة */
  complete(id: string, result: AudioResult, extra?: Pick<JobPatch, "stage" | "fellBack">): Promise<void>;
  /** يحفظ الطلب بعد تحويرات المنفّذ (كالتشكيل التلقائي) — فتقرأه الواجهة مع الحالة */
  saveRequest(id: string, request: MusicRequest): Promise<void>;
  getAudio(id: string): Promise<{ audio: Buffer; mimeType: string } | undefined>;
  /** آخر مهام المستخدم — سجل «توليداتي» في الاستوديو */
  listRecent(userId: string, limit?: number): Promise<SongJob[]>;
}

/* ------------------------- مخزن الذاكرة (تطوير) ------------------------- */

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOBS = 200;

type MemoryEntry = { job: SongJob; audio?: Buffer };

// globalThis ليصمد المخزن أمام إعادة التحميل الساخن أثناء التطوير
const globalStore = globalThis as unknown as { __songJobs?: Map<string, MemoryEntry> };
const memoryJobs = (globalStore.__songJobs ??= new Map<string, MemoryEntry>());

function pruneMemory() {
  const now = Date.now();
  for (const [id, entry] of memoryJobs) {
    if (now - entry.job.updatedAt > JOB_TTL_MS) memoryJobs.delete(id);
  }
  if (memoryJobs.size > MAX_JOBS) {
    const oldest = [...memoryJobs.values()].sort((a, b) => a.job.createdAt - b.job.createdAt);
    for (const entry of oldest.slice(0, memoryJobs.size - MAX_JOBS)) {
      memoryJobs.delete(entry.job.id);
    }
  }
}

export const memoryJobsStore: JobsStore = {
  id: "memory",
  async create(tier, request, userId = null) {
    pruneMemory();
    const now = Date.now();
    const job: SongJob = {
      id: randomUUID(),
      status: "pending",
      stage: "بانتظار البدء",
      tier,
      userId,
      request,
      createdAt: now,
      updatedAt: now,
    };
    memoryJobs.set(job.id, { job });
    return job;
  },
  async get(id) {
    return memoryJobs.get(id)?.job;
  },
  async update(id, patch) {
    const entry = memoryJobs.get(id);
    if (entry) Object.assign(entry.job, patch, { updatedAt: Date.now() });
  },
  async saveRequest(id, request) {
    const entry = memoryJobs.get(id);
    if (entry) {
      entry.job.request = request;
      entry.job.updatedAt = Date.now();
    }
  },
  async complete(id, result, extra) {
    const entry = memoryJobs.get(id);
    if (!entry) return;
    entry.audio = result.audio;
    // معرّف المحرك يُحفظ داخل الطلب ليتاح إعادة التوليد الجزئي لاحقاً
    if (result.providerSongId) entry.job.request.elevenSongId = result.providerSongId;
    Object.assign(entry.job, {
      status: "done" as const,
      stage: extra?.stage ?? "اكتمل التوليد",
      provider: result.provider,
      mimeType: result.mimeType,
      mock: !!result.mock,
      ...(extra?.fellBack && { fellBack: extra.fellBack }),
      updatedAt: Date.now(),
    });
  },
  async getAudio(id) {
    const entry = memoryJobs.get(id);
    if (!entry?.audio || !entry.job.mimeType) return undefined;
    return { audio: entry.audio, mimeType: entry.job.mimeType };
  },
  async listRecent(userId, limit = 10) {
    return [...memoryJobs.values()]
      .map((e) => e.job)
      .filter((j) => j.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  },
};

/* ------------------------ مخزن Supabase (إنتاج) ------------------------ */

const TABLE = "song_jobs";
const BUCKET = "jobs";

type JobRow = {
  id: string;
  status: JobStatus;
  stage: string;
  tier: GenerationTier;
  user_id: string | null;
  request: MusicRequest;
  provider: string | null;
  mime_type: string | null;
  mock: boolean;
  fell_back: string | null;
  error: string | null;
  audio_path: string | null;
  created_at: string;
  updated_at: string;
};

function rowToJob(row: JobRow): SongJob {
  return {
    id: row.id,
    status: row.status,
    stage: row.stage,
    tier: row.tier,
    userId: row.user_id,
    request: row.request,
    provider: row.provider ?? undefined,
    mimeType: row.mime_type ?? undefined,
    mock: row.mock,
    fellBack: row.fell_back ?? undefined,
    error: row.error ?? undefined,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function patchToRow(patch: JobPatch): Record<string, unknown> {
  return {
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.stage !== undefined && { stage: patch.stage }),
    ...(patch.provider !== undefined && { provider: patch.provider }),
    ...(patch.mimeType !== undefined && { mime_type: patch.mimeType }),
    ...(patch.mock !== undefined && { mock: patch.mock }),
    ...(patch.fellBack !== undefined && { fell_back: patch.fellBack }),
    ...(patch.error !== undefined && { error: patch.error }),
    updated_at: new Date().toISOString(),
  };
}

export const supabaseJobsStore: JobsStore = {
  id: "supabase",
  async create(tier, request, userId = null) {
    const admin = getSupabaseAdmin()!;
    const id = randomUUID();
    const { data, error } = await admin
      .from(TABLE)
      .insert({ id, status: "pending", stage: "بانتظار البدء", tier, user_id: userId, request })
      .select()
      .single();
    if (error) throw new Error(`تعذّر إنشاء المهمة: ${error.message}`);
    return rowToJob(data as JobRow);
  },
  async get(id) {
    const admin = getSupabaseAdmin()!;
    const { data, error } = await admin.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error || !data) return undefined;
    return rowToJob(data as JobRow);
  },
  async update(id, patch) {
    const admin = getSupabaseAdmin()!;
    await admin.from(TABLE).update(patchToRow(patch)).eq("id", id);
  },
  async saveRequest(id, request) {
    const admin = getSupabaseAdmin()!;
    await admin
      .from(TABLE)
      .update({ request, updated_at: new Date().toISOString() })
      .eq("id", id);
  },
  async complete(id, result, extra) {
    const admin = getSupabaseAdmin()!;
    const path = `${id}.${result.mimeType === "audio/mpeg" ? "mp3" : "wav"}`;
    const upload = await admin.storage.from(BUCKET).upload(path, result.audio, {
      contentType: result.mimeType,
      upsert: true,
    });
    if (upload.error) throw new Error(`تعذّر تخزين الناتج: ${upload.error.message}`);

    // معرّف المحرك يُحفظ داخل jsonb الطلب (بلا تعديل مخطط) لإعادة التوليد الجزئي
    let requestUpdate: Record<string, unknown> = {};
    if (result.providerSongId) {
      const { data: row } = await admin.from(TABLE).select("request").eq("id", id).maybeSingle();
      if (row?.request) {
        requestUpdate = { request: { ...row.request, elevenSongId: result.providerSongId } };
      }
    }

    await admin
      .from(TABLE)
      .update({
        ...patchToRow({
          status: "done",
          stage: extra?.stage ?? "اكتمل التوليد",
          provider: result.provider,
          mimeType: result.mimeType,
          mock: !!result.mock,
          ...(extra?.fellBack && { fellBack: extra.fellBack }),
        }),
        audio_path: path,
        ...requestUpdate,
      })
      .eq("id", id);
  },
  async getAudio(id) {
    const admin = getSupabaseAdmin()!;
    const { data: row } = await admin
      .from(TABLE)
      .select("audio_path, mime_type")
      .eq("id", id)
      .maybeSingle();
    if (!row?.audio_path || !row.mime_type) return undefined;
    const { data, error } = await admin.storage.from(BUCKET).download(row.audio_path);
    if (error || !data) return undefined;
    return { audio: Buffer.from(await data.arrayBuffer()), mimeType: row.mime_type };
  },
  async listRecent(userId, limit = 10) {
    const admin = getSupabaseAdmin()!;
    const { data, error } = await admin
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as JobRow[]).map(rowToJob);
  },
};

/** اختيار المخزن: Supabase عند توفر مفتاح الخدمة (الإنتاج)، وإلا الذاكرة (التطوير) */
export function getJobsStore(): JobsStore {
  return getSupabaseAdmin() ? supabaseJobsStore : memoryJobsStore;
}
