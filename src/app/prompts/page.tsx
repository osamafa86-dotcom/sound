"use client";

import { useEffect, useState } from "react";
import { PROMPT_TYPES } from "@/lib/promptSmith";
import { PASS_SCORE, MAX_ROUNDS } from "@/lib/promptAgent";
import { authHeaders } from "@/lib/supabase";

type Crafted = {
  title: string;
  prompt: string;
  promptAlt?: string;
  negativePrompt?: string;
  tips: string[];
};

type Review = {
  clarity: number;
  completeness: number;
  platformFit: number;
  executability: number;
  total: number;
  verdict: string;
  issues: { severity: string; issue: string; fix: string }[];
};

type RoundEvent =
  | { kind: "draft"; assumptions: string[] }
  | { kind: "review"; round: number; review: Review }
  | { kind: "refine"; round: number };

type LibraryCraft = {
  id: string;
  type_id: string;
  brief: string;
  result: Crafted;
  score: number | null;
  feedback: number | null;
};

type ImageTest = {
  imageBase64: string;
  mimeType: string;
  judgment: { match: number; gaps: string[]; note: string };
};

export default function PromptsStudio() {
  const [typeId, setTypeId] = useState(PROMPT_TYPES[0].id);
  const [platform, setPlatform] = useState("");
  const [brief, setBrief] = useState("");
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState<RoundEvent[]>([]);
  const [result, setResult] = useState<Crafted | null>(null);
  const [finalScore, setFinalScore] = useState<number | null>(null);
  const [craftId, setCraftId] = useState<string | null>(null);
  const [copied, setCopied] = useState("");

  const [imageTest, setImageTest] = useState<ImageTest | null>(null);
  const [testing, setTesting] = useState(false);
  const [variants, setVariants] = useState<{ platform: string; prompt: string }[] | null>(null);
  const [porting, setPorting] = useState(false);

  const [library, setLibrary] = useState<LibraryCraft[]>([]);

  const type = PROMPT_TYPES.find((t) => t.id === typeId)!;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prompts/library")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setLibrary(d.crafts ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function pickType(id: string) {
    setTypeId(id);
    setPlatform("");
    resetOutput();
  }

  function resetOutput() {
    setResult(null);
    setEvents([]);
    setFinalScore(null);
    setCraftId(null);
    setImageTest(null);
    setVariants(null);
    setError("");
  }

  async function agentCall(action: string, extra: Record<string, unknown> = {}) {
    const res = await fetch("/api/prompts/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ action, typeId, brief, platform: platform || undefined, ...extra }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "تعذّرت العملية");
    return data;
  }

  /** الحلقة الوكيلية: مسودة ← حكم ← (تحسين ← حكم)* حتى العتبة أو نفاد الجولات */
  async function craft() {
    if (!brief.trim() || working) return;
    setWorking(true);
    resetOutput();
    try {
      setStage("📝 المهندس يكتب المسودة...");
      let current: Crafted & { assumptions?: string[] } = await agentCall("draft");
      setEvents([{ kind: "draft", assumptions: current.assumptions ?? [] }]);
      setResult(current);

      let lastTotal: number | null = null;
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        setStage(`⚖️ الحكم الناقد يفحص (جولة ${round})...`);
        const review = (await agentCall("review", { prompt: current.prompt })) as Review;
        setEvents((prev) => [...prev, { kind: "review", round, review }]);
        setFinalScore(review.total);
        lastTotal = review.total;
        if (review.total >= PASS_SCORE || round === MAX_ROUNDS || !review.issues.length) break;

        setStage(`✨ المحسِّن يعالج الثغرات (جولة ${round})...`);
        current = await agentCall("refine", { current, issues: review.issues });
        setEvents((prev) => [...prev, { kind: "refine", round }]);
        setResult(current);
      }

      // الحفظ في مكتبة المستخدم (يتجاهل بصمت لغير المسجلين)
      const saved = await fetch("/api/prompts/library", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          typeId,
          platform: platform || undefined,
          brief,
          result: current,
          score: lastTotal ?? undefined,
        }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (saved?.id) {
        setCraftId(saved.id);
        setLibrary((prev) => [
          { id: saved.id, type_id: typeId, brief, result: current, score: lastTotal, feedback: null },
          ...prev,
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setWorking(false);
      setStage("");
    }
  }

  /** التجربة الحية للصور: توليد فعلي + حكم رؤية ثم تحسين مما رأى */
  async function runImageTest() {
    if (!result || testing) return;
    setTesting(true);
    setError("");
    try {
      const res = await fetch("/api/prompts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ brief, prompt: result.prompt, negativePrompt: result.negativePrompt }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّرت التجربة");
      setImageTest(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setTesting(false);
    }
  }

  async function refineFromTest() {
    if (!result || !imageTest?.judgment.gaps.length || working) return;
    setWorking(true);
    setError("");
    try {
      setStage("✨ المحسِّن يعالج ما رآه ناقد الرؤية...");
      const refined = await agentCall("refine", {
        current: result,
        issues: imageTest.judgment.gaps.map((g) => ({
          severity: "عالية",
          issue: `في الصورة الفعلية: ${g}`,
          fix: "عدّل البرومبت ليضمن ظهور هذا العنصر صحيحاً",
        })),
      });
      setResult(refined);
      setImageTest(null);
      setEvents((prev) => [...prev, { kind: "refine", round: 0 }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setWorking(false);
      setStage("");
    }
  }

  async function portToAll() {
    if (!result || porting) return;
    setPorting(true);
    setError("");
    try {
      const data = await agentCall("port", { prompt: result.prompt });
      setVariants(data.variants ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setPorting(false);
    }
  }

  async function feedback(id: string, value: 1 | -1) {
    setLibrary((prev) => prev.map((c) => (c.id === id ? { ...c, feedback: value } : c)));
    await fetch("/api/prompts/library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ id, feedback: value }),
    }).catch(() => {});
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("تعذّر النسخ — حدد النص وانسخه يدوياً");
    }
  }

  const scoreColor = (n: number) =>
    n >= PASS_SCORE ? "text-accent" : n >= 70 ? "text-gold" : "text-red-400";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        وكيل <span className="text-gradient">البرومبتات</span>
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        غرفة صياغة كاملة: مهندس يكتب، وحكم ناقد يهاجم، ومحسِّن يعالج — جولات تراها
        أمامك حتى يتجاوز البرومبت عتبة الجودة ({PASS_SCORE}/100). وللصور: تجربة حية بصورة إثبات.
      </p>

      {/* أنواع البرومبتات */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {PROMPT_TYPES.map((t) => (
          <button
            key={t.id}
            onClick={() => pickType(t.id)}
            className={`rounded-2xl border p-4 text-start transition-colors ${
              typeId === t.id
                ? "border-primary bg-primary/10"
                : "border-border-soft bg-surface-card hover:border-primary/50"
            }`}
          >
            <span className="text-2xl">{t.icon}</span>
            <span className="mt-2 block font-bold">{t.name}</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">{t.desc}</span>
          </button>
        ))}
      </div>

      {/* الطلب */}
      <div className="mt-8 rounded-3xl border border-border-soft bg-surface-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold">المنصة المستهدفة:</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-raised px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="">عام — الأصلح لهذا النوع</option>
            {type.platforms.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="صف ما تريد بلغتك العادية — الوكيل يتكفل بالحرفة"
          className="mt-4 w-full resize-y rounded-2xl border border-border-soft bg-surface p-4 leading-relaxed outline-none transition-colors focus:border-primary"
        />

        {error && (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={craft}
          disabled={working || !brief.trim()}
          className="mt-4 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {working ? stage || "جارٍ العمل..." : `🤖 شغّل غرفة الصياغة — ${type.name}`}
        </button>
      </div>

      {/* جولات الغرفة الحية */}
      {events.length > 0 && (
        <div className="mt-6 flex flex-col gap-2">
          {events.map((e, i) => (
            <div key={i} className="rounded-2xl border border-border-soft bg-surface-card/60 px-5 py-3 text-sm">
              {e.kind === "draft" && (
                <div>
                  <p className="font-semibold">📝 المهندس كتب المسودة</p>
                  {e.assumptions.length > 0 && (
                    <ul className="mt-1 text-xs text-muted">
                      {e.assumptions.map((a, j) => (
                        <li key={j}>• افترض: {a}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {e.kind === "review" && (
                <div>
                  <p className="font-semibold">
                    ⚖️ حكم الجولة {e.round}:{" "}
                    <span className={scoreColor(e.review.total)}>{e.review.total}/100</span>
                    <span className="mx-2 text-xs text-muted">
                      (وضوح {e.review.clarity} · اكتمال {e.review.completeness} · التزام المنصة{" "}
                      {e.review.platformFit} · قابلية تنفيذ {e.review.executability})
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted">{e.review.verdict}</p>
                  {e.review.issues.length > 0 && e.review.total < PASS_SCORE && (
                    <ul className="mt-1 text-xs text-muted">
                      {e.review.issues.map((issue, j) => (
                        <li key={j}>
                          🔍 [{issue.severity}] {issue.issue}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {e.kind === "refine" && (
                <p className="font-semibold">
                  ✨ المحسِّن عالج الثغرات{e.round ? ` (جولة ${e.round})` : " مما رأى ناقد الرؤية"}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* الناتج النهائي */}
      {result && !working && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-3xl border border-primary/40 bg-surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">
                ✨ {result.title}
                {finalScore !== null && (
                  <span className={`mx-3 text-sm font-bold ${scoreColor(finalScore)}`}>
                    {finalScore}/100
                  </span>
                )}
              </h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => copy(result.prompt, "main")}
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
                >
                  {copied === "main" ? "✓ نُسخ" : "📋 انسخ البرومبت"}
                </button>
                {typeId === "image" && (
                  <button
                    onClick={runImageTest}
                    disabled={testing}
                    title="توليد صورة فعلية بالبرومبت وحكم رؤية عليها"
                    className="rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
                  >
                    {testing ? "جارٍ التجربة..." : "🧪 جرّبه حياً"}
                  </button>
                )}
                <button
                  onClick={portToAll}
                  disabled={porting}
                  title="نسخ البرومبت بلهجات بقية منصات هذا النوع"
                  className="rounded-xl border border-border-soft px-4 py-2 text-sm font-semibold transition-colors hover:border-gold hover:text-gold disabled:opacity-50"
                >
                  {porting ? "جارٍ النقل..." : "🌐 لكل المنصات"}
                </button>
              </div>
            </div>
            <pre
              dir={type.primaryLang === "en" ? "ltr" : "rtl"}
              className="mt-4 whitespace-pre-wrap rounded-2xl bg-surface p-4 text-start text-sm leading-relaxed"
            >
              {result.prompt}
            </pre>

            {result.promptAlt && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-muted hover:text-body">
                  {type.primaryLang === "en" ? "🔎 الترجمة العربية (لفهمك — الصق الإنجليزي)" : "🔎 النسخة الإنجليزية"}
                </summary>
                <pre
                  dir={type.primaryLang === "en" ? "rtl" : "ltr"}
                  className="mt-2 whitespace-pre-wrap rounded-2xl bg-surface p-4 text-start text-sm leading-relaxed text-muted"
                >
                  {result.promptAlt}
                </pre>
              </details>
            )}

            {result.negativePrompt && (
              <div className="mt-3 rounded-2xl border border-border-soft bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">🚫 البرومبت السلبي (ما يُستبعد):</p>
                  <button
                    onClick={() => copy(result.negativePrompt!, "neg")}
                    className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
                  >
                    {copied === "neg" ? "✓ نُسخ" : "📋 انسخ"}
                  </button>
                </div>
                <pre dir="ltr" className="mt-2 whitespace-pre-wrap text-start text-xs leading-relaxed text-muted">
                  {result.negativePrompt}
                </pre>
              </div>
            )}
          </div>

          {/* صورة الإثبات وحكم الرؤية */}
          {imageTest && (
            <div className="rounded-3xl border border-accent/40 bg-surface-card p-6">
              <h3 className="text-lg font-bold">
                🧪 التجربة الحية — مطابقة الصورة للطلب:{" "}
                <span className={imageTest.judgment.match >= 8 ? "text-accent" : "text-gold"}>
                  {imageTest.judgment.match}/10
                </span>
              </h3>
              {/* eslint-disable-next-line @next/next/no-img-element -- صورة إثبات مولّدة */}
              <img
                src={`data:${imageTest.mimeType};base64,${imageTest.imageBase64}`}
                alt="صورة الإثبات المولّدة بالبرومبت"
                className="mx-auto mt-4 w-full max-w-md rounded-2xl border border-border-soft"
              />
              <p className="mt-3 text-sm text-muted">{imageTest.judgment.note}</p>
              {imageTest.judgment.gaps.length > 0 && (
                <>
                  <ul className="mt-2 text-sm text-muted">
                    {imageTest.judgment.gaps.map((g, i) => (
                      <li key={i}>👁️ {g}</li>
                    ))}
                  </ul>
                  <button
                    onClick={refineFromTest}
                    disabled={working}
                    className="mt-3 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    🔁 حسّن البرومبت بما رأى الناقد
                  </button>
                </>
              )}
            </div>
          )}

          {/* حزمة المنصات */}
          {variants && variants.length > 0 && (
            <div className="rounded-3xl border border-gold/40 bg-surface-card p-6">
              <h3 className="text-lg font-bold">🌐 نسخ بلهجات المنصات الأخرى</h3>
              <div className="mt-3 flex flex-col gap-3">
                {variants.map((v, i) => (
                  <div key={i} className="rounded-2xl border border-border-soft bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-bold">{v.platform}</p>
                      <button
                        onClick={() => copy(v.prompt, `variant-${i}`)}
                        className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
                      >
                        {copied === `variant-${i}` ? "✓ نُسخ" : "📋 انسخ"}
                      </button>
                    </div>
                    <pre dir="auto" className="mt-2 whitespace-pre-wrap text-start text-xs leading-relaxed text-muted">
                      {v.prompt}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.tips.length > 0 && (
            <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
              <h3 className="text-sm font-bold">💡 نصائح لنتيجة أفضل</h3>
              <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-relaxed text-muted">
                {result.tips.map((tip, i) => (
                  <li key={i}>• {tip}</li>
                ))}
              </ul>
            </div>
          )}

          {craftId && (
            <div className="rounded-2xl border border-border-soft bg-surface-card p-4 text-sm">
              <span className="text-muted">حُفظ في برومبتاتك — كيف كانت النتيجة على المنصة؟</span>
              <button
                onClick={() => feedback(craftId, 1)}
                className="mx-2 rounded-lg border border-accent px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
              >
                ⭐ اشتغل ممتاز
              </button>
              <button
                onClick={() => feedback(craftId, -1)}
                className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted hover:border-red-500/50 hover:text-red-400"
              >
                ❌ ما نفع
              </button>
              <span className="mx-2 text-xs text-muted">
                تقييمك يجعل أنجح البرومبتات أمثلة تتحسن بها الصياغات القادمة للجميع
              </span>
            </div>
          )}
        </div>
      )}

      {/* برومبتاتك الأخيرة */}
      {library.length > 0 && (
        <div className="mt-10 rounded-3xl border border-border-soft bg-surface-card/60 p-6">
          <h3 className="text-lg font-bold">🗂️ برومبتاتك الأخيرة</h3>
          <div className="mt-3 flex flex-col gap-2">
            {library.slice(0, 8).map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-soft bg-surface px-4 py-2.5 text-sm"
              >
                <span className="min-w-0 flex-1 truncate">
                  {PROMPT_TYPES.find((t) => t.id === c.type_id)?.icon}{" "}
                  <span className="font-semibold">{c.result?.title ?? c.brief}</span>
                  {c.score !== null && (
                    <span className={`mx-2 text-xs ${scoreColor(c.score)}`}>{c.score}/100</span>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  <button
                    onClick={() => copy(c.result.prompt, `lib-${c.id}`)}
                    className="rounded-lg border border-border-soft px-2.5 py-1 text-xs text-muted hover:text-body"
                  >
                    {copied === `lib-${c.id}` ? "✓" : "📋"}
                  </button>
                  <button
                    onClick={() => feedback(c.id, 1)}
                    title="اشتغل ممتاز"
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      c.feedback === 1 ? "border-accent text-accent" : "border-border-soft text-muted hover:text-accent"
                    }`}
                  >
                    ⭐
                  </button>
                  <button
                    onClick={() => feedback(c.id, -1)}
                    title="ما نفع"
                    className={`rounded-lg border px-2.5 py-1 text-xs ${
                      c.feedback === -1 ? "border-red-500/60 text-red-400" : "border-border-soft text-muted hover:text-red-400"
                    }`}
                  >
                    ❌
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
