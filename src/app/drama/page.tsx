"use client";

import { useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import SaveToLibrary from "@/components/SaveToLibrary";
import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";
import { authHeaders } from "@/lib/supabase";
import { DRAMA_LIMITS, type DramaScript } from "@/lib/drama/types";

const SAMPLE = `كان جدّي يجلس كل مساء على عتبة البيت، يلفّ سيجارته ببطء ويحدّق في أشجار الزيتون.

اقتربت منه حفيدته الصغيرة وسألته: يا جدّي، ليش دايماً بتتطلّع عالشجر؟

ابتسم الجد وقال: لأن هالشجر يا بنتي أقدم مني ومنك. جدّي زرعه، وأنا كبرت تحته، وإنتِ رح تكبري تحته كمان.

قالت الطفلة بحماس: يعني الشجرة بتعرفنا كلنا؟

ضحك الجد وربّت على رأسها: بتعرفنا وبتتذكرنا. كل غصن فيها إله حكاية.

وساد الصمت لحظة، ثم همست الطفلة: بدي أزرع شجرة كمان، عشان تتذكرني.`;

export default function DramaStudio() {
  const [text, setText] = useState("");
  const [script, setScript] = useState<DramaScript | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; duration: string; voices: string } | null>(null);

  async function analyze() {
    if (!text.trim()) return;
    setError("");
    setResult(null);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/drama/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تحليل النص");
      setScript(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setAnalyzing(false);
    }
  }

  async function render() {
    if (!script) return;
    setError("");
    setRendering(true);
    try {
      const res = await fetch("/api/drama/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify(script),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر إنتاج العمل");
      }
      const duration = res.headers.get("X-Duration") ?? "";
      const voices = res.headers.get("X-Voices") ?? "";
      const blob = await res.blob();
      setResult({ url: URL.createObjectURL(blob), duration, voices });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setRendering(false);
    }
  }

  /** تغيير صوت شخصية يدوياً قبل الإنتاج */
  function setCharacterVoice(charId: string, voiceId: string) {
    setScript((prev) =>
      prev
        ? { ...prev, characters: prev.characters.map((c) => (c.id === charId ? { ...c, voiceId } : c)) }
        : prev
    );
  }

  const charName = (id: string) => script?.characters.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        🎭 الاستوديو <span className="text-gradient">الدرامي</span>
      </h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        الصق قصة أو حواراً، فيوزّع الذكاء الاصطناعي الأدوار على أصوات مختلفة، ويشكّل كل سطر،
        ويضبط انفعاله وإيقاعه — ثم ينتج عملاً مسموعاً واحداً متكامل الأصوات.
      </p>

      {/* الخطوة 1: النص */}
      <div className="mt-8 flex flex-col gap-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={DRAMA_LIMITS.maxInputChars}
          placeholder="الصق قصتك أو حوارك هنا..."
          className="min-h-56 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-loose outline-none transition-colors focus:border-gold"
        />
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>
            {text.length} / {DRAMA_LIMITS.maxInputChars} حرف · حتى {DRAMA_LIMITS.maxLines} سطراً
          </span>
          <button onClick={() => setText(SAMPLE)} className="text-accent hover:underline">
            جرّب نصاً جاهزاً
          </button>
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={analyze}
          disabled={analyzing || !text.trim()}
          className="self-start rounded-xl bg-gold px-6 py-3 font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {analyzing ? "جارٍ توزيع الأدوار..." : "🎬 حلّل النص ووزّع الأدوار"}
        </button>
      </div>

      {/* الخطوة 2: السيناريو */}
      {script && (
        <div className="mt-10 flex flex-col gap-6">
          <div className="rounded-2xl border border-gold/40 bg-gold/5 p-5">
            <h2 className="text-xl font-bold">{script.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{script.summary}</p>
            <p className="mt-2 text-xs text-muted">
              المزاج: {script.mood} · المقام المقترح للموسيقى:{" "}
              {MAQAMAT.find((m) => m.id === script.maqamId)?.name} · {script.lines.length} سطراً ·{" "}
              {script.characters.length} شخصيات
            </p>
          </div>

          {/* طاقم الأصوات */}
          <div>
            <h3 className="mb-3 text-lg font-bold">🎙️ طاقم الأصوات</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {script.characters.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border-soft bg-surface-card p-4">
                  <p className="font-bold">{c.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{c.description}</p>
                  <select
                    value={c.voiceId}
                    onChange={(e) => setCharacterVoice(c.id, e.target.value)}
                    className="mt-3 w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
                  >
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.dialect} ({v.gender === "male" ? "ذكر" : "أنثى"})
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs leading-relaxed text-accent">{c.voiceReason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* السيناريو سطراً سطراً */}
          <div>
            <h3 className="mb-3 text-lg font-bold">📜 السيناريو</h3>
            <div className="max-h-96 overflow-y-auto rounded-2xl border border-border-soft bg-surface-card p-4">
              <div className="flex flex-col gap-2.5">
                {script.lines.map((l, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <span className="w-24 shrink-0 truncate font-semibold text-gold" title={charName(l.characterId)}>
                      {charName(l.characterId)}
                    </span>
                    <span className="flex-1 leading-relaxed">{l.text}</span>
                    <span className="w-20 shrink-0 text-xs text-muted" title={`ثبات ${l.stability} · سرعة ${l.speed}`}>
                      {l.emotion}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={render}
            disabled={rendering}
            className="self-start rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {rendering
              ? `جارٍ إنتاج ${script.lines.length} سطراً بأصوات مختلفة...`
              : "🎧 أنتج العمل المسموع"}
          </button>

          {rendering && (
            <p className="text-xs text-muted">
              كل سطر يُولَّد بصوت شخصيته وانفعاله — قد يستغرق دقيقة إلى دقيقتين.
            </p>
          )}

          {result && (
            <AudioPlayer
              src={result.url}
              title={`${script.title} — ${result.voices} أصوات · ${Math.round(Number(result.duration))} ثانية`}
              filename={`${script.title}.wav`}
              note="عمل مسموع متعدد الأصوات، بوقفات محسوبة بين الأسطر والمشاهد."
            >
              <SaveToLibrary
                url={result.url}
                kind="tts"
                title={script.title}
                content={script.summary}
                provider="elevenlabs"
                settings={{ drama: true, lines: script.lines.length, characters: script.characters.length }}
              />
            </AudioPlayer>
          )}
        </div>
      )}
    </div>
  );
}
