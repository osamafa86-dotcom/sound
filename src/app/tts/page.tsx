"use client";

import { useMemo, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import { DIALECTS, VOICES } from "@/lib/voices";

export default function TTSStudio() {
  const [text, setText] = useState("");
  const [dialect, setDialect] = useState<string>("الكل");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);
  const [speed, setSpeed] = useState(1);
  const [stability, setStability] = useState(0.5);
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; mock: boolean } | null>(null);
  const [error, setError] = useState("");

  const shownVoices = useMemo(
    () => (dialect === "الكل" ? VOICES : VOICES.filter((v) => v.dialect === dialect)),
    [dialect]
  );

  async function generate() {
    if (!text.trim()) {
      setError("اكتب النص أولاً");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, speed, stability, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر التوليد، حاول مجدداً");
      }
      const mock = res.headers.get("X-Mock") === "1";
      const blob = await res.blob();
      setResult({ url: URL.createObjectURL(blob), mock });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        استوديو <span className="text-gradient">النص إلى صوت</span>
      </h1>
      <p className="mt-2 text-muted">
        اكتب نصك، اختر الصوت واللهجة، واضبط الأداء — ثم استمع وحمّل الناتج.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* النص */}
        <div className="flex flex-col gap-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            placeholder={"اكتب النص هنا...\nمثال: أهلاً بكم في منصة مقام، حيث تتحول الكلمات إلى صوتٍ نابضٍ بالحياة."}
            className="min-h-72 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-relaxed outline-none transition-colors focus:border-primary"
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{text.length} / 5000 حرف</span>
            <span>تدعم الفصحى واللهجات</span>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {loading ? "جارٍ التوليد..." : "🎙️ توليد الصوت"}
          </button>

          {result && <AudioPlayer src={result.url} title="الناتج الصوتي" mock={result.mock} />}
        </div>

        {/* الإعدادات */}
        <aside className="flex h-fit flex-col gap-5 rounded-2xl border border-border-soft bg-surface-card p-5">
          <div>
            <label className="mb-2 block text-sm font-semibold">اللهجة</label>
            <select
              value={dialect}
              onChange={(e) => {
                setDialect(e.target.value);
                const first = e.target.value === "الكل" ? VOICES[0] : VOICES.find((v) => v.dialect === e.target.value);
                if (first) setVoiceId(first.id);
              }}
              className="w-full rounded-xl border border-border-soft bg-surface-raised px-3 py-2.5 outline-none focus:border-primary"
            >
              <option>الكل</option>
              {DIALECTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">الصوت</label>
            <div className="flex flex-col gap-2">
              {shownVoices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoiceId(v.id)}
                  className={`rounded-xl border px-3 py-2.5 text-start transition-colors ${
                    voiceId === v.id
                      ? "border-primary bg-primary/10"
                      : "border-border-soft hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-semibold">
                      {v.gender === "male" ? "👨" : "👩"} {v.name}
                      <span className="mx-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                        {v.dialect}
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">{v.tone}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 flex justify-between text-sm font-semibold">
              <span>السرعة</span>
              <span className="text-muted">{speed.toFixed(2)}×</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-2 flex justify-between text-sm font-semibold">
              <span>الثبات ↔ التعبير</span>
              <span className="text-muted">{Math.round(stability * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={stability}
              onChange={(e) => setStability(Number(e.target.value))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-muted">
              ثبات أعلى = أداء متزن؛ ثبات أقل = تعبير عاطفي أقوى
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">صيغة الملف</label>
            <div className="grid grid-cols-2 gap-2">
              {(["mp3", "wav"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-xl border py-2 text-sm font-semibold uppercase transition-colors ${
                    format === f ? "border-primary bg-primary/10" : "border-border-soft"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
