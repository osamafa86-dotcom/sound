"use client";

import { useState } from "react";
import { PROMPT_TYPES } from "@/lib/promptSmith";
import { authHeaders } from "@/lib/supabase";

type Crafted = {
  title: string;
  prompt: string;
  promptAlt?: string;
  negativePrompt?: string;
  tips: string[];
};

export default function PromptsStudio() {
  const [typeId, setTypeId] = useState(PROMPT_TYPES[0].id);
  const [platform, setPlatform] = useState("");
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Crafted | null>(null);
  const [copied, setCopied] = useState("");

  const type = PROMPT_TYPES.find((t) => t.id === typeId)!;

  function pickType(id: string) {
    setTypeId(id);
    setPlatform("");
    setResult(null);
    setError("");
  }

  async function craft() {
    if (!brief.trim() || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    setCopied("");
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ typeId, brief, platform: platform || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّرت الصياغة، حاول مجدداً");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
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

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        مهندس <span className="text-gradient">البرومبتات</span>
      </h1>
      <p className="mt-2 max-w-2xl text-muted">
        اختصاصي لكل نوع مادة: صف ما تريده بلغتك العادية، وسيصوغه برومبتاً احترافياً
        جاهزاً للصق — بقواعد الحرفة الحقيقية لكل مجال ومنصة.
      </p>

      {/* أنواع البرومبتات */}
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          placeholder={`صف ما تريد — مثلاً: ${
            type.id === "image"
              ? "صورة لبيت فلسطيني قديم بين أشجار الزيتون وقت الغروب"
              : type.id === "video"
                ? "مشهد لخيول تركض على شاطئ البحر عند الفجر"
                : type.id === "news"
                  ? "خبر عن افتتاح معرض للتراث الفلسطيني في عمان لنشرة مسائية"
                  : "فكرتك بلغتك العادية وسنحولها برومبتاً محترفاً"
          }`}
          className="mt-4 w-full resize-y rounded-2xl border border-border-soft bg-surface p-4 leading-relaxed outline-none transition-colors focus:border-primary"
        />

        {error && (
          <p className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={craft}
          disabled={loading || !brief.trim()}
          className="mt-4 rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "جارٍ الهندسة..." : `⚡ اصنع برومبت ${type.name}`}
        </button>
      </div>

      {/* الناتج */}
      {result && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="rounded-3xl border border-primary/40 bg-surface-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">✨ {result.title}</h2>
              <button
                onClick={() => copy(result.prompt, "main")}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
              >
                {copied === "main" ? "✓ نُسخ" : "📋 انسخ البرومبت"}
              </button>
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
        </div>
      )}
    </div>
  );
}
