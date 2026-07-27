"use client";

import { useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import SaveToLibrary from "@/components/SaveToLibrary";
import WaveLine from "@/components/WaveLine";
import { DIALECTS, INSTRUMENTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { authHeaders } from "@/lib/supabase";
import type { AssistMode, AssistResult } from "@/lib/assistant/types";

const STEPS = ["الكلمات", "المقام والأسلوب", "التوليد"] as const;

type AssistResponse = AssistResult & { fellBack?: string };

type JobStatusResponse = {
  status: "pending" | "running" | "done" | "failed";
  stage?: string;
  provider?: string;
  stylePrompt?: string;
  mock?: boolean;
  fellBack?: string;
  error?: string;
};

const DURATIONS = [
  { sec: 60, label: "دقيقة" },
  { sec: 120, label: "دقيقتان" },
  { sec: 180, label: "3 دقائق" },
] as const;

type SongResult = {
  url: string;
  blob: Blob;
  jobId: string;
  mock: boolean;
  prompt: string;
  ext: string;
  fellBack: boolean;
  provider?: string;
  /** لقطة وقت التوليد — تسمح بعرض النسخ السابقة بعناوينها الصحيحة */
  maqamName: string;
  title: string;
};

type ImageBriefResponse = {
  titleAr: string;
  descriptionAr: string;
  maqamId: string;
  maqamReason: string;
  stylePromptEn: string;
};

export default function SongsStudio() {
  const [step, setStep] = useState(0);
  const [lyrics, setLyrics] = useState("");
  const [maqamId, setMaqamId] = useState(MAQAMAT[0].id);
  const [styleId, setStyleId] = useState<string>(SONG_STYLES[0].id);
  const [instrumentIds, setInstrumentIds] = useState<string[]>(["oud", "darbuka"]);
  const [tier, setTier] = useState<"preview" | "full">("full");
  const [durationSec, setDurationSec] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [result, setResult] = useState<SongResult | null>(null);
  /** كل نسخ هذه الجلسة بالأحدث أولاً — للمقارنة واختيار الأفضل */
  const [versions, setVersions] = useState<SongResult[]>([]);
  const [error, setError] = useState("");

  const [idea, setIdea] = useState("");
  const [dialectId, setDialectId] = useState<string>(DIALECTS[0].id);
  const [assist, setAssist] = useState<AssistResponse | null>(null);
  const [assistLoading, setAssistLoading] = useState<"" | AssistMode>("");
  const [assistError, setAssistError] = useState("");

  // من صورة إلى موسيقى — عين المنصة
  const [imageBrief, setImageBrief] = useState<ImageBriefResponse | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [imageError, setImageError] = useState("");

  const maqam = MAQAMAT.find((m) => m.id === maqamId)!;
  const instrumental = styleId === "instrumental";

  function toggleInstrument(id: string) {
    setInstrumentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function runAssist(mode: AssistMode) {
    setAssistError("");
    setAssistLoading(mode);
    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ mode, idea, lyrics, dialectId, styleId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "تعذّر تشغيل المساعد، حاول مجدداً");
      }
      setAssist(data);
      setLyrics(data.lyrics);
      setMaqamId(data.maqamId);
    } catch (e) {
      setAssistError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setAssistLoading("");
    }
  }

  async function analyzeImage(file: File) {
    setImageError("");
    setImageBrief(null);
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    setImageAnalyzing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/songs/image-brief", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تحليل الصورة");
      setImageBrief(data);
      // اعتماد قراءة الصورة تلقائياً: مقامها المقترح وأسلوب موسيقي آلي
      setMaqamId(data.maqamId);
      setStyleId("instrumental");
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setImageAnalyzing(false);
    }
  }

  async function generate() {
    setError("");
    setLoading(true);
    setStage("جارٍ إنشاء المهمة...");
    setResult(null);
    try {
      // أولوية البرومبت: موجز الصورة ثم المساعد — ما دام المستخدم باقياً على المقام المقترح
      const aiStylePrompt =
        imageBrief && imageBrief.maqamId === maqamId && styleId === "instrumental"
          ? imageBrief.stylePromptEn
          : assist && assist.maqamId === maqamId
            ? assist.stylePromptEn
            : undefined;

      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          lyrics,
          maqamId,
          styleId,
          instrumentIds,
          tier,
          durationSec,
          aiStylePrompt,
          // «نسخة أخرى»: رقم النسخة يدفع المحرك للتنويع بدل تكرار التوزيع
          variation: versions.length,
        }),
      });
      const created = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(created?.error ?? "تعذّر التوليد، حاول مجدداً");
      }
      const jobId: string = created.jobId;

      // استعلام دوري عن حالة المهمة حتى الاكتمال (مهلة قصوى 5 دقائق)
      const started = Date.now();
      let status: JobStatusResponse | null = null;
      while (Date.now() - started < 5 * 60_000) {
        await new Promise((r) => setTimeout(r, 1500));
        const sres = await fetch(`/api/songs/${jobId}`);
        status = (await sres.json().catch(() => null)) as JobStatusResponse | null;
        if (!sres.ok) {
          throw new Error(status?.error ?? "تعذّر متابعة حالة المهمة");
        }
        setStage(status?.stage ?? "");
        if (status?.status === "done") break;
        if (status?.status === "failed") {
          throw new Error(status.error ?? "فشل التوليد، حاول مجدداً");
        }
      }
      if (status?.status !== "done") {
        throw new Error("انتهت مهلة انتظار التوليد، حاول مجدداً");
      }

      const ares = await fetch(`/api/songs/${jobId}/audio`);
      if (!ares.ok) {
        throw new Error("تعذّر جلب الملف الصوتي");
      }
      const blob = await ares.blob();
      const ext = blob.type === "audio/mpeg" ? "mp3" : "wav";
      const maqamName = MAQAMAT.find((m) => m.id === maqamId)?.name ?? "";
      const song: SongResult = {
        url: URL.createObjectURL(blob),
        blob,
        jobId,
        mock: !!status.mock,
        prompt: status.stylePrompt ?? "",
        ext,
        fellBack: !!status.fellBack,
        provider: status.provider,
        maqamName,
        title:
          assist?.title && assist.title !== "مسودة تجريبية"
            ? assist.title
            : imageBrief?.titleAr && styleId === "instrumental"
              ? imageBrief.titleAr
              : tier === "preview"
                ? `معاينة بمقام ${maqamName}`
                : `أغنية بمقام ${maqamName}`,
      };
      setResult(song);
      setVersions((prev) => [song, ...prev]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
      setStage("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        استوديو <span className="text-gradient">الأغاني والمقامات</span>
      </h1>
      <WaveLine className="mt-3" />
      <p className="mt-3 text-muted">
        ثلاث خطوات: اكتب الكلمات، اختر المقام والأسلوب، ثم ولّد أغنيتك.
      </p>

      {/* شريط الخطوات */}
      <ol className="mt-8 flex gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button
              onClick={() => setStep(i)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                i === step
                  ? "border-primary bg-rose text-primary"
                  : i < step
                    ? "border-border-soft text-body"
                    : "border-border-soft text-muted"
              }`}
            >
              {i + 1}. {s}
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {/* الخطوة 1: الكلمات */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            {/* مساعد الكلمات والمقامات */}
            <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
              <h2 className="text-lg font-bold">
                ✨ مساعد <span className="text-gradient">الكلمات والمقامات</span>
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                اكتب فكرة أغنيتك ليؤلّف لك المساعد الكلمات ويقترح المقام الأنسب لمعناها، أو الصق كلماتك الجاهزة في الأسفل ثم حسّنها.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  value={idea}
                  onChange={(e) => setIdea(e.target.value)}
                  maxLength={500}
                  placeholder="فكرة الأغنية... مثال: شوق للوطن بعد سنين غربة"
                  className="flex-1 rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
                />
                <select
                  value={dialectId}
                  onChange={(e) => setDialectId(e.target.value)}
                  className="rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
                >
                  {DIALECTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => runAssist("write")}
                  disabled={!!assistLoading || !idea.trim()}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistLoading === "write" ? "جارٍ التأليف..." : "✨ اكتب لي الكلمات"}
                </button>
                <button
                  onClick={() => runAssist("improve")}
                  disabled={!!assistLoading || !lyrics.trim()}
                  className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-rose disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {assistLoading === "improve" ? "جارٍ التحسين..." : "✨ حسّن كلماتي واقترح المقام"}
                </button>
              </div>
              {assistError && (
                <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
                  {assistError}
                </p>
              )}
              {assist && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-rose p-4 text-sm">
                  <p className="font-semibold text-primary">
                    {assist.title && assist.title !== "مسودة تجريبية" && `«${assist.title}» — `}
                    المقام المقترح: {MAQAMAT.find((m) => m.id === assist.maqamId)?.name}
                  </p>
                  <p className="mt-1 leading-relaxed">{assist.maqamReason}</p>
                  <p className="mt-2 text-xs text-muted">
                    اعتُمد المقام المقترح تلقائياً — يمكنك تغييره في الخطوة التالية.
                  </p>
                  {assist.mock && (
                    <p className="mt-2 text-xs text-muted">
                      {assist.fellBack
                        ? "تعذّر الوصول لمحرك Claude من هذه البيئة، فعُرض اقتراح تجريبي مبسّط بدلاً منه."
                        : "اقتراح من الوضع التجريبي — يُفعَّل التأليف والتحليل الفعليان عند ربط مفتاح Claude API."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* من صورة إلى موسيقى */}
            <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
              <h2 className="text-lg font-bold">
                🖼️ من صورة إلى <span className="text-gradient">موسيقى</span>
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                ارفع صورة — مشهداً، لوحة، ذكرى — وستقرأ المنصة مزاجها وتقترح المقام وتؤلف لها موسيقاها.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10">
                  {imageAnalyzing ? "جارٍ قراءة الصورة..." : imagePreview ? "🖼️ صورة أخرى" : "🖼️ اختر صورة"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={imageAnalyzing}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) analyzeImage(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {imagePreview && (
                  /* eslint-disable-next-line @next/next/no-img-element -- معاينة blob محلية */
                  <img
                    src={imagePreview}
                    alt="الصورة المرفوعة"
                    className="h-16 w-16 rounded-xl border border-border-soft object-cover"
                  />
                )}
              </div>
              {imageError && (
                <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
                  {imageError}
                </p>
              )}
              {imageBrief && (
                <div className="mt-4 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
                  <p className="font-semibold text-accent">
                    «{imageBrief.titleAr}» — المقام المقترح: {MAQAMAT.find((m) => m.id === imageBrief.maqamId)?.name}
                  </p>
                  <p className="mt-1 leading-relaxed">{imageBrief.descriptionAr}</p>
                  <p className="mt-1 text-xs text-muted">{imageBrief.maqamReason}</p>
                  <button
                    onClick={() => setStep(2)}
                    className="mt-3 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
                  >
                    🎼 اعتمد وانتقل للتوليد ←
                  </button>
                </div>
              )}
            </div>

            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              maxLength={3000}
              placeholder={"اكتب كلمات أغنيتك هنا (فصحى أو لهجة)...\nأو استخدم المساعد بالأعلى ليكتبها لك من فكرة."}
              className="min-h-72 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-loose outline-none transition-colors focus:border-primary"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{lyrics.length} / 3000 حرف</span>
            </div>
            <button
              onClick={() => setStep(1)}
              className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              التالي: اختيار المقام ←
            </button>
          </div>
        )}

        {/* الخطوة 2: المقام والأسلوب */}
        {step === 1 && (
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="mb-4 text-xl font-bold">اختر المقام</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {MAQAMAT.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMaqamId(m.id)}
                    className={`rounded-2xl border p-4 text-start transition-colors ${
                      maqamId === m.id
                        ? "border-primary bg-rose"
                        : "border-border-soft bg-surface-card hover:border-primary/50"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-lg font-bold">{m.name}</span>
                      {maqamId === m.id && <span className="text-primary">✓</span>}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-accent">{m.mood}</span>
                    <span className="mt-2 block text-xs leading-relaxed text-muted">{m.description}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-bold">الأسلوب الغنائي</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {SONG_STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyleId(s.id)}
                    className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      styleId === s.id
                        ? "border-primary bg-primary/10"
                        : "border-border-soft bg-surface-card hover:border-primary/50"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-bold">الآلات</h2>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map((inst) => (
                  <button
                    key={inst.id}
                    onClick={() => toggleInstrument(inst.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      instrumentIds.includes(inst.id)
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border-soft text-muted hover:text-body"
                    }`}
                  >
                    {inst.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
            >
              التالي: التوليد ←
            </button>
          </div>
        )}

        {/* الخطوة 3: التوليد */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            <div>
              <h2 className="mb-4 text-xl font-bold">مستوى التوليد</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => setTier("preview")}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    tier === "preview"
                      ? "border-primary bg-rose"
                      : "border-border-soft bg-surface-card hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold">🎧 معاينة سريعة</span>
                    {tier === "preview" && <span className="text-primary">✓</span>}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted">
                    مسودة آلية ~30 ثانية لتجربة المقام والأسلوب بأقل تكلفة (Lyria 3)، قبل توليد النسخة النهائية.
                  </span>
                </button>
                <button
                  onClick={() => setTier("full")}
                  className={`rounded-2xl border p-4 text-start transition-colors ${
                    tier === "full"
                      ? "border-primary bg-rose"
                      : "border-border-soft bg-surface-card hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="text-lg font-bold">🎼 النسخة الكاملة</span>
                    {tier === "full" && <span className="text-primary">✓</span>}
                  </span>
                  <span className="mt-2 block text-xs leading-relaxed text-muted">
                    {instrumental
                      ? "موسيقى آلية كاملة بالمقام المختار (Lyria 3 Pro)."
                      : "أغنية كاملة بالغناء العربي عبر Eleven Music."}
                  </span>
                </button>
              </div>
              {tier === "full" && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted">المدة التقريبية:</span>
                  {DURATIONS.map((d) => (
                    <button
                      key={d.sec}
                      onClick={() => setDurationSec(d.sec)}
                      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                        durationSec === d.sec
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border-soft text-muted hover:text-body"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-border-soft bg-surface-card p-6">
              <h2 className="mb-4 text-xl font-bold">ملخص أغنيتك</h2>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted">المقام</dt>
                  <dd className="font-semibold">{maqam.name} — {maqam.mood}</dd>
                </div>
                <div>
                  <dt className="text-muted">الأسلوب</dt>
                  <dd className="font-semibold">{SONG_STYLES.find((s) => s.id === styleId)?.name}</dd>
                </div>
                <div>
                  <dt className="text-muted">الآلات</dt>
                  <dd className="font-semibold">
                    {instrumentIds.length
                      ? INSTRUMENTS.filter((i) => instrumentIds.includes(i.id)).map((i) => i.name).join("، ")
                      : "اختيار تلقائي"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">الكلمات</dt>
                  <dd className="font-semibold">
                    {instrumental ? "موسيقى آلية بدون غناء" : lyrics.trim() ? `${lyrics.trim().split(/\s+/).length} كلمة` : "بدون كلمات بعد"}
                  </dd>
                </div>
              </dl>
            </div>

            {error && (
              <p className="rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
                {error}
              </p>
            )}

            <button
              onClick={generate}
              disabled={loading}
              className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {loading
                ? stage || "جارٍ التلحين والتوليد..."
                : tier === "preview"
                  ? "🎧 ولّد المعاينة"
                  : "🎼 ولّد الأغنية"}
            </button>

            {result && (
              <div className="flex flex-col gap-4">
                <AudioPlayer
                  src={result.url}
                  title={
                    result.mock
                      ? `معاينة مقام ${result.maqamName} (سلّم المقام بأرباع النغمات)`
                      : versions.length > 1
                        ? `«${result.title}» — النسخة ${versions.length}`
                        : `«${result.title}»`
                  }
                  mock={result.mock}
                  filename={`maqam-song-v${versions.length}.${result.ext}`}
                  note={
                    result.fellBack
                      ? "تعذّر الوصول لمحرك التوليد من هذه البيئة (أو تتطلب الميزة باقة مدفوعة)، فعُرض سلّم المقام التجريبي بدلاً منه."
                      : undefined
                  }
                >
                  <SaveToLibrary
                    url={result.url}
                    kind="song"
                    title={result.title}
                    content={lyrics}
                    maqamId={maqamId}
                    styleId={styleId}
                    provider={result.provider}
                    settings={{ instrumentIds, tier, durationSec, stylePrompt: result.prompt }}
                  />
                </AudioPlayer>

                <button
                  onClick={generate}
                  disabled={loading}
                  className="self-start rounded-xl border border-primary px-5 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-rose disabled:opacity-50"
                >
                  🔁 ولّد نسخة أخرى بنفس الإعدادات
                </button>

                {result.prompt && (
                  <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
                    <p className="mb-2 text-sm font-semibold">البرومبت الموسيقي المُولَّد لمحرك الذكاء الاصطناعي:</p>
                    <code dir="ltr" className="block rounded-lg bg-surface p-3 text-xs leading-relaxed text-accent">
                      {result.prompt}
                    </code>
                  </div>
                )}

                {versions.length > 1 && (
                  <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-muted">نسخ سابقة للمقارنة — احفظ أفضلها في مكتبتك</h3>
                    {versions.slice(1).map((v, i) => (
                      <AudioPlayer
                        key={v.jobId}
                        src={v.url}
                        title={`«${v.title}» — النسخة ${versions.length - 1 - i}`}
                        mock={v.mock}
                        filename={`maqam-song-v${versions.length - 1 - i}.${v.ext}`}
                      >
                        <SaveToLibrary
                          url={v.url}
                          kind="song"
                          title={v.title}
                          content={lyrics}
                          maqamId={maqamId}
                          styleId={styleId}
                          provider={v.provider}
                          settings={{ instrumentIds, tier, durationSec, stylePrompt: v.prompt }}
                        />
                      </AudioPlayer>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
