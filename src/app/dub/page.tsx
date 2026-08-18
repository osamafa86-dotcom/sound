"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Globe2, History, Loader2, Trash2, UploadCloud } from "lucide-react";
import MemberNotice from "@/components/MemberNotice";
import WaveLine from "@/components/WaveLine";
import {
  DUB_MAX_BYTES,
  DUB_SOURCES,
  DUB_TARGETS,
  dubLanguageName,
  type DubStatus,
} from "@/lib/dubbing";
import { authHeaders } from "@/lib/supabase";

/**
 * 🌍 استوديو الدبلجة — ينقل عملاً صوتياً أو فيديو إلى لغة أخرى بنفس
 * صوت المتحدث وأدائه. المشروع يجري لدى المحرك بشكل غير متزامن:
 * نبدأه ثم نستطلع حالته دورياً وننزّل الناتج عند اكتماله، ونحفظ
 * المعرّفات محلياً كي يستعيد المستخدم نواتجه حتى بعد مغادرة الصفحة.
 */

type DubJob = {
  id: string;
  fileName: string;
  targetLang: string;
  startedAt: number;
  expectedSec: number | null;
  video: boolean;
};

const HISTORY_KEY = "maqamDubJobs";
const HISTORY_MAX = 12;

function loadHistory(): DubJob[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list = raw ? (JSON.parse(raw) as DubJob[]) : [];
    return Array.isArray(list) ? list.filter((j) => j && typeof j.id === "string") : [];
  } catch {
    return [];
  }
}

function fmtClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function fmtSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} ك.ب`
    : `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
}

export default function DubStudioPage() {
  const [file, setFile] = useState<File | null>(null);
  const [targetLang, setTargetLang] = useState("en");
  const [sourceLang, setSourceLang] = useState("auto");
  const [numSpeakers, setNumSpeakers] = useState(0);
  const [dropBackground, setDropBackground] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [job, setJob] = useState<DubJob | null>(null);
  const [status, setStatus] = useState<DubStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaMime, setMediaMime] = useState("");
  const [history, setHistory] = useState<DubJob[]>([]);

  // رمز تتبع: أي مسار استطلاع قديم يتوقف فور تجاوز رمزه (استبدال أو مغادرة)
  const trackToken = useRef(0);

  useEffect(() => {
    // تأجيل القراءة لما بعد الرسم الأول — يرضي قاعدة عدم التزامن في التأثيرات
    const t = setTimeout(() => setHistory(loadHistory()), 0);
    const token = trackToken;
    return () => {
      clearTimeout(t);
      token.current += 1; // يوقف أي حلقة استطلاع جارية عند مغادرة الصفحة
    };
  }, []);

  useEffect(() => {
    if (!mediaUrl) return;
    return () => URL.revokeObjectURL(mediaUrl);
  }, [mediaUrl]);

  useEffect(() => {
    if (status !== "dubbing") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  function persistHistory(list: DubJob[]) {
    setHistory(list);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, HISTORY_MAX)));
    } catch {
      /* التخزين المحلي ممتلئ أو معطّل — السجل رفاهية لا شرط */
    }
  }

  async function fetchResult(j: DubJob, token: number) {
    try {
      const res = await fetch(`/api/dub/${j.id}/audio?lang=${j.targetLang}`, {
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        throw new Error(data.error ?? "تعذّر تنزيل الناتج");
      }
      const blob = await res.blob();
      if (trackToken.current !== token) return;
      setMediaMime(blob.type || (j.video ? "video/mp4" : "audio/mpeg"));
      setMediaUrl(URL.createObjectURL(blob));
      setStatus("dubbed");
    } catch (e) {
      if (trackToken.current !== token) return;
      setStatus("failed");
      setError(e instanceof Error ? e.message : "تعذّر تنزيل الناتج");
    }
  }

  /** يتابع مشروعاً حتى اكتماله: استطلاع كل ٦ ثوانٍ ثم تنزيل تلقائي */
  async function track(j: DubJob) {
    const token = ++trackToken.current;
    setJob(j);
    setStatus("dubbing");
    setError("");
    setMediaUrl("");
    setMediaMime("");
    setElapsed(Math.max(0, Math.round((Date.now() - j.startedAt) / 1000)));

    for (;;) {
      let remote: { status?: string; error?: string } = {};
      try {
        const res = await fetch(`/api/dub/${j.id}`, { headers: await authHeaders() });
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
          error?: string;
        };
        if (trackToken.current !== token) return;
        if (!res.ok) {
          setStatus("failed");
          setError(data.error ?? "تعذّر متابعة حالة المشروع");
          return;
        }
        remote = data;
      } catch {
        if (trackToken.current !== token) return;
        remote = { status: "dubbing" }; // عثرة شبكة عابرة — نواصل الاستطلاع
      }

      if (remote.status === "dubbed") {
        await fetchResult(j, token);
        return;
      }
      if (remote.status === "failed") {
        setStatus("failed");
        setError(
          remote.error ??
            "تعثرت الدبلجة لدى المحرك — جرّب مقطعاً أوضح صوتاً أو أقصر مدة"
        );
        return;
      }

      await new Promise((r) => setTimeout(r, 6000));
      if (trackToken.current !== token) return;
    }
  }

  async function start() {
    if (!file || busy) return;
    if (file.size > DUB_MAX_BYTES) {
      setError("الحد الأقصى لحجم الملف 25 ميغابايت — قصّ المقطع أو اضغطه أولاً");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      form.append("targetLang", targetLang);
      form.append("sourceLang", sourceLang);
      form.append("numSpeakers", String(numSpeakers));
      form.append("dropBackground", dropBackground ? "1" : "0");

      const res = await fetch("/api/dub", {
        method: "POST",
        headers: await authHeaders(),
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        expectedSec?: number | null;
        error?: string;
      };
      if (!res.ok || !data.id) {
        setError(data.error ?? "تعذّر بدء الدبلجة — جرّب مجدداً");
        return;
      }

      const j: DubJob = {
        id: data.id,
        fileName: file.name,
        targetLang,
        startedAt: Date.now(),
        expectedSec: data.expectedSec ?? null,
        video: file.type.startsWith("video"),
      };
      persistHistory([j, ...history.filter((h) => h.id !== j.id)]);
      void track(j);
    } finally {
      setBusy(false);
    }
  }

  function removeFromHistory(id: string) {
    persistHistory(history.filter((h) => h.id !== id));
  }

  const progress =
    job?.expectedSec && job.expectedSec > 5
      ? Math.min(96, Math.round((elapsed / job.expectedSec) * 100))
      : null;
  const isVideoOut = mediaMime.includes("mp4") || mediaMime.startsWith("video");
  const downloadName = job
    ? `مقام-دبلجة-${dubLanguageName(job.targetLang)}.${isVideoOut ? "mp4" : "mp3"}`
    : "dub.mp3";

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-10">
      <p className="flex items-center gap-2.5 text-sm font-bold text-primary">
        <span className="h-1 w-5 rounded-full bg-primary" />
        الاستوديوهات
      </p>
      <h1 className="mt-3 flex items-center gap-3 text-3xl font-extrabold md:text-4xl">
        <Globe2 className="h-8 w-8 text-primary" strokeWidth={1.8} />
        استوديو الدبلجة
      </h1>
      <WaveLine className="mt-4" />
      <p className="mt-5 max-w-2xl leading-relaxed text-muted">
        انقل أي عمل صوتي أو فيديو إلى لغة أخرى <span className="font-bold text-body">بنفس صوت المتحدث</span> وأدائه
        وإيقاعه — مشهد درامي، حلقة بودكاست، سرد، إعلان. مصمّمة للكلام المنطوق؛
        الغناء الملحّن خارج نطاقها الموثوق.
      </p>

      <MemberNotice />

      {/* بطاقة الإعداد */}
      <div className="mt-6 rounded-3xl border border-border-soft bg-surface-card p-6">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border-strong px-6 py-8 text-center transition-colors hover:border-primary">
          <UploadCloud className="h-8 w-8 text-primary" strokeWidth={1.6} />
          {file ? (
            <>
              <span className="font-bold">{file.name}</span>
              <span className="text-xs text-muted">
                {fmtSize(file.size)}
                {file.type.startsWith("video") && " — فيديو: الناتج فيديو مدبلج"}
              </span>
            </>
          ) : (
            <>
              <span className="font-bold">اختر ملفاً صوتياً أو فيديو</span>
              <span className="text-xs text-muted">MP3، WAV، MP4… حتى 25 ميغابايت</span>
            </>
          )}
          <input
            type="file"
            accept="audio/*,video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError("");
            }}
          />
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            لغة المقطع الأصلي
            <select
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value)}
              className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm font-normal"
            >
              {DUB_SOURCES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            دبلجة إلى
            <select
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm font-normal"
            >
              {DUB_TARGETS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            عدد المتحدثين
            <select
              value={numSpeakers}
              onChange={(e) => setNumSpeakers(Number(e.target.value))}
              className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm font-normal"
            >
              <option value={0}>اكتشاف تلقائي</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2.5 self-end rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={dropBackground}
              onChange={(e) => setDropBackground(e.target.checked)}
              className="h-4 w-4 accent-[var(--primary)]"
            />
            إزالة الموسيقى والخلفية (كلام أنقى)
          </label>
        </div>

        {targetLang === sourceLang && (
          <p className="mt-3 text-sm font-semibold text-primary">
            لغة الهدف يجب أن تختلف عن لغة المصدر.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-muted">
            كل عملية تخصم <span className="font-bold text-body">٣٠ نقطة</span> — المقاطع القصيرة
            (٣٠–٩٠ ثانية) هي الأمثل للتجربة الأولى.
          </p>
          <button
            onClick={start}
            disabled={busy || !file || targetLang === sourceLang}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Globe2 className="h-[18px] w-[18px]" />}
            {busy ? "جارٍ رفع المقطع…" : "ابدأ الدبلجة"}
          </button>
        </div>

        {error && !job && (
          <p className="mt-4 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm font-semibold text-primary">
            {error}
          </p>
        )}
      </div>

      {/* بطاقة المتابعة والناتج */}
      {job && (
        <div className="mt-6 rounded-3xl border border-border-soft bg-surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">
              دبلجة «{job.fileName}» إلى{" "}
              <span className="text-primary">{dubLanguageName(job.targetLang)}</span>
            </h2>
            {status === "dubbing" && (
              <span className="flex items-center gap-2 rounded-full bg-rose px-3 py-1 text-xs font-semibold text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                جارية — {fmtClock(elapsed)}
              </span>
            )}
          </div>

          {status === "dubbing" && (
            <>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-surface-raised">
                {progress !== null ? (
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-primary/60" />
                )}
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {job.expectedSec
                  ? `التقدير المبدئي: ~${fmtClock(job.expectedSec)} (دقائق:ثوانٍ)`
                  : "تستغرق الدبلجة عادة دقيقة إلى بضع دقائق حسب طول المقطع"}
                {" — "}تستطيع مغادرة الصفحة والعودة لاحقاً؛ مشروعك محفوظ في «مشاريعي» أدناه.
              </p>
            </>
          )}

          {status === "failed" && (
            <p className="mt-4 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm font-semibold text-primary">
              {error || "تعثرت الدبلجة — جرّب مجدداً"}
            </p>
          )}

          {status === "dubbed" && mediaUrl && (
            <div className="mt-4">
              {isVideoOut ? (
                <video controls src={mediaUrl} className="w-full rounded-xl" />
              ) : (
                <audio controls src={mediaUrl} className="w-full" />
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  href={mediaUrl}
                  download={downloadName}
                  className="flex items-center gap-2 rounded-xl border border-primary/50 px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-rose"
                >
                  <Download className="h-4 w-4" />
                  تنزيل الناتج
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* المشاريع السابقة */}
      {history.length > 0 && (
        <div className="mt-6 rounded-3xl border border-border-soft bg-surface-card p-6">
          <h2 className="flex items-center gap-2 font-bold">
            <History className="h-5 w-5 text-primary" strokeWidth={1.8} />
            مشاريعي الأخيرة
          </h2>
          <div className="mt-3 flex flex-col divide-y divide-border-soft">
            {history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{h.fileName}</p>
                  <p className="text-xs text-muted">
                    إلى {dubLanguageName(h.targetLang)} —{" "}
                    {new Date(h.startedAt).toLocaleString("ar", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => void track(h)}
                    className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-rose"
                  >
                    استرجاع الناتج
                  </button>
                  <button
                    onClick={() => removeFromHistory(h.id)}
                    aria-label="حذف من السجل"
                    className="grid h-8 w-8 place-items-center rounded-lg border border-border-strong text-muted transition-colors hover:border-primary hover:text-primary"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-faint">
            السجل محفوظ على جهازك، والنواتج تبقى قابلة للاسترجاع من المحرك لفترة محدودة.
          </p>
        </div>
      )}

      {/* كيف تعمل */}
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          { n: "٠١", t: "ارفع مقطعك", d: "صوت أو فيديو حتى ٢٥ م.ب — الكلام الواضح يعطي أفضل نتيجة." },
          { n: "٠٢", t: "اختر اللغة", d: "١٥ لغة هدفاً، مع اكتشاف تلقائي للغة الأصل وعدد المتحدثين." },
          { n: "٠٣", t: "استلم العمل", d: "نفس الصوت والأداء باللغة الجديدة — استمع ونزّل وشارك." },
        ].map((s) => (
          <div key={s.n} className="rounded-2xl border border-border-soft bg-surface-card p-5">
            <span className="font-heading text-3xl font-extrabold leading-none text-primary/90">{s.n}</span>
            <p className="mt-2 font-bold">{s.t}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
