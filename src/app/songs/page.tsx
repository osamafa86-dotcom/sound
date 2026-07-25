"use client";

import { useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import { INSTRUMENTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";

const STEPS = ["الكلمات", "المقام والأسلوب", "التوليد"] as const;

export default function SongsStudio() {
  const [step, setStep] = useState(0);
  const [lyrics, setLyrics] = useState("");
  const [maqamId, setMaqamId] = useState(MAQAMAT[0].id);
  const [styleId, setStyleId] = useState<string>(SONG_STYLES[0].id);
  const [instrumentIds, setInstrumentIds] = useState<string[]>(["oud", "darbuka"]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; mock: boolean; prompt: string; ext: string; fellBack: boolean } | null>(null);
  const [error, setError] = useState("");

  const maqam = MAQAMAT.find((m) => m.id === maqamId)!;
  const instrumental = styleId === "instrumental";

  function toggleInstrument(id: string) {
    setInstrumentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function generate() {
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lyrics, maqamId, styleId, instrumentIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر التوليد، حاول مجدداً");
      }
      const mock = res.headers.get("X-Mock") === "1";
      const fellBack = res.headers.has("X-Fallback");
      const prompt = decodeURIComponent(res.headers.get("X-Style-Prompt") ?? "");
      const blob = await res.blob();
      const ext = blob.type === "audio/mpeg" ? "mp3" : "wav";
      setResult({ url: URL.createObjectURL(blob), mock, prompt, ext, fellBack });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        استوديو <span className="text-gradient">الأغاني والمقامات</span>
      </h1>
      <p className="mt-2 text-muted">
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
                  ? "border-gold bg-gold/10 text-gold"
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
            <textarea
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              maxLength={3000}
              placeholder={"اكتب كلمات أغنيتك هنا (فصحى أو لهجة)...\n\nقريباً: مساعد الذكاء الاصطناعي لكتابة الكلمات وتحسينها واقتراح المقام الأنسب لمعناها."}
              className="min-h-72 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-loose outline-none transition-colors focus:border-gold"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{lyrics.length} / 3000 حرف</span>
              <button
                disabled
                title="يُفعَّل مع ربط مفتاح Claude API"
                className="cursor-not-allowed rounded-xl border border-border-soft px-4 py-2 text-sm text-muted opacity-60"
              >
                ✨ تحسين بالذكاء الاصطناعي (قريباً)
              </button>
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
                        ? "border-gold bg-gold/10"
                        : "border-border-soft bg-surface-card hover:border-gold/50"
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span className="text-lg font-bold">{m.name}</span>
                      {maqamId === m.id && <span className="text-gold">✓</span>}
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
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              onClick={generate}
              disabled={loading}
              className="rounded-xl bg-gold px-6 py-3.5 font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "جارٍ التلحين والتوليد..." : "🎼 ولّد الأغنية"}
            </button>

            {result && (
              <div className="flex flex-col gap-4">
                <AudioPlayer
                  src={result.url}
                  title={
                    result.mock
                      ? `معاينة مقام ${maqam.name} (سلّم المقام بأرباع النغمات)`
                      : `أغنيتك بمقام ${maqam.name}`
                  }
                  mock={result.mock}
                  filename={`maqam-song.${result.ext}`}
                  note={
                    result.fellBack
                      ? "تعذّر الوصول لمحرك التوليد من هذه البيئة (أو تتطلب الميزة باقة مدفوعة)، فعُرض سلّم المقام التجريبي بدلاً منه."
                      : undefined
                  }
                />
                {result.prompt && (
                  <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
                    <p className="mb-2 text-sm font-semibold">البرومبت الموسيقي المُولَّد لمحرك الذكاء الاصطناعي:</p>
                    <code dir="ltr" className="block rounded-lg bg-surface p-3 text-xs leading-relaxed text-accent">
                      {result.prompt}
                    </code>
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
