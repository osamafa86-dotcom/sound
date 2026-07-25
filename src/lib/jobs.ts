import { randomUUID } from "crypto";
import type { AudioResult, MusicRequest } from "./providers/types";

/**
 * نظام المهام الطويلة — توليد الأغنية يستغرق وقتاً، فيُنشأ Job ويستعلم
 * العميل عن حالته دورياً بدل انتظار طلب HTTP واحد طويل.
 *
 * المخزن حالياً داخل الذاكرة (يكفي للتطوير والاستضافة على خادم واحد)،
 * وينتقل إلى جدول Jobs في Supabase ضمن المرحلة 4 لأن الاستضافة
 * Serverless لا تضمن بقاء الذاكرة بين الطلبات.
 */

export type GenerationTier = "preview" | "full";
export type JobStatus = "pending" | "running" | "done" | "failed";

export type SongJob = {
  id: string;
  status: JobStatus;
  /** وصف المرحلة الحالية بالعربية للعرض في الواجهة */
  stage: string;
  createdAt: number;
  updatedAt: number;
  tier: GenerationTier;
  request: MusicRequest;
  result?: AudioResult;
  error?: string;
  /** سبب الرجوع للوضع التجريبي إن حدث */
  fellBack?: string;
};

// globalThis ليصمد المخزن أمام إعادة التحميل الساخن أثناء التطوير
const globalStore = globalThis as unknown as { __songJobs?: Map<string, SongJob> };
const jobs = (globalStore.__songJobs ??= new Map<string, SongJob>());

const JOB_TTL_MS = 30 * 60 * 1000;
const MAX_JOBS = 200;

function prune() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.updatedAt > JOB_TTL_MS) jobs.delete(id);
  }
  // حماية من التضخم: حذف الأقدم عند تجاوز الحد
  if (jobs.size > MAX_JOBS) {
    const oldest = [...jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
    for (const job of oldest.slice(0, jobs.size - MAX_JOBS)) jobs.delete(job.id);
  }
}

export function createJob(tier: GenerationTier, request: MusicRequest): SongJob {
  prune();
  const now = Date.now();
  const job: SongJob = {
    id: randomUUID(),
    status: "pending",
    stage: "بانتظار البدء",
    createdAt: now,
    updatedAt: now,
    tier,
    request,
  };
  jobs.set(job.id, job);
  return job;
}

export function getJob(id: string): SongJob | undefined {
  return jobs.get(id);
}

export function updateJob(id: string, patch: Partial<Omit<SongJob, "id" | "createdAt">>): SongJob | undefined {
  const job = jobs.get(id);
  if (!job) return undefined;
  Object.assign(job, patch, { updatedAt: Date.now() });
  return job;
}
