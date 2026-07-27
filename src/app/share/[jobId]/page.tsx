import Link from "next/link";
import type { Metadata } from "next";
import { getJobsStore } from "@/lib/jobs";
import { MAQAMAT } from "@/lib/maqamat";

/** صفحة مشاركة عامة لأغنية مولّدة — تعمل بمعرّف المهمة غير القابل للتخمين */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ jobId: string }> };

async function loadJob(jobId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return null;
  const job = await getJobsStore().get(jobId);
  return job?.status === "done" ? job : null;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { jobId } = await params;
  const job = await loadJob(jobId);
  const maqam = job ? MAQAMAT.find((m) => m.id === job.request.maqamId) : null;
  const title = maqam ? `أغنية بمقام ${maqam.name} — منصة مقام` : "منصة مقام";
  const description = maqam
    ? `استمع لأغنية وُلّدت بالذكاء الاصطناعي بمقام ${maqam.name} (${maqam.mood}) على منصة مقام، وأنشئ أغنيتك الخاصة مجاناً.`
    : "منصة عربية لتوليد الأغاني والأصوات بالذكاء الاصطناعي";
  return {
    title,
    description,
    openGraph: { title, description, type: "music.song" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({ params }: Params) {
  const { jobId } = await params;
  const job = await loadJob(jobId);

  if (!job) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <span className="text-5xl">🎵</span>
        <h1 className="mt-4 text-2xl font-bold">هذا الرابط لم يعد متاحاً</h1>
        <p className="mt-2 text-muted">ربما انتهت صلاحية المشاركة أو حُذف العمل.</p>
        <Link
          href="/songs"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-strong"
        >
          أنشئ أغنيتك الخاصة ←
        </Link>
      </div>
    );
  }

  const maqam = MAQAMAT.find((m) => m.id === job.request.maqamId);
  const lyrics = job.request.lyrics?.trim();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-3xl border border-gold/30 bg-surface-card p-8">
        <p className="text-sm text-muted">مشاركة من منصة مقام 🎼</p>
        <h1 className="mt-2 text-3xl font-bold">
          أغنية بمقام <span className="text-gradient">{maqam?.name ?? "عربي"}</span>
        </h1>
        {maqam && <p className="mt-1 text-sm text-accent">{maqam.mood}</p>}

        <audio controls src={`/api/songs/${job.id}/audio`} className="mt-6 w-full" preload="metadata" />

        {lyrics && (
          <div className="mt-6 rounded-2xl border border-border-soft bg-surface p-5">
            <h2 className="mb-2 text-sm font-bold text-muted">الكلمات</h2>
            <p className="whitespace-pre-wrap leading-loose">{lyrics}</p>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-primary/10 p-5 text-center">
          <p className="font-semibold">أعجبتك؟ أنشئ أغنيتك الخاصة بأي مقام ولهجة — مجاناً</p>
          <Link
            href="/songs"
            className="mt-3 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            🎼 جرّب استوديو الأغاني
          </Link>
        </div>
      </div>
    </div>
  );
}
