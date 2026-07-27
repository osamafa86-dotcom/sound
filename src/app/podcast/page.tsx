"use client";

import { useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import WaveLine from "@/components/WaveLine";
import SaveToLibrary from "@/components/SaveToLibrary";
import { VOICES } from "@/lib/voices";
import { authHeaders } from "@/lib/supabase";
import { ANY_DIALECT, DIALECT_OPTIONS } from "@/lib/dialects";
import { PODCAST_LIMITS, type PodcastLength, type PodcastTone } from "@/lib/podcast/script";
import type { DramaScript } from "@/lib/drama/types";

const LENGTHS: { id: PodcastLength; label: string; hint: string }[] = [
  { id: "short", label: "قصيرة", hint: "~3 دقائق" },
  { id: "medium", label: "متوسطة", hint: "~6 دقائق" },
  { id: "long", label: "طويلة", hint: "~10 دقائق" },
];

const TONES: { id: PodcastTone; label: string; hint: string }[] = [
  { id: "informative", label: "معرفي", hint: "شرح رصين بأمثلة" },
  { id: "casual", label: "ودّي", hint: "حوار خفيف بين صديقين" },
  { id: "debate", label: "نقاشي", hint: "وجهتا نظر تتحاوران" },
  { id: "storytelling", label: "سردي", hint: "الموضوع يُروى كقصة" },
];

export default function PodcastStudio() {
  const [topic, setTopic] = useState("");
  const [length, setLength] = useState<PodcastLength>("medium");
  const [tone, setTone] = useState<PodcastTone>("informative");
  const [dialect, setDialect] = useState<string>(ANY_DIALECT);

  // مصدر الحلقة: موضوع تؤلَّف منه، أو نص المستخدم (مقال/سيناريو) يتحول حواراً
  const [source, setSource] = useState<"topic" | "text">("topic");
  const [sourceText, setSourceText] = useState("");
  const [importing, setImporting] = useState(false);
  const [introMusic, setIntroMusic] = useState(true);

  const [script, setScript] = useState<DramaScript | null>(null);
  const [writing, setWriting] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; duration: string; theme: boolean } | null>(null);

  // تحرير مداخلة قبل الإنتاج
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  /** استيراد ملف نصي: TXT/MD مباشرة، وDOCX عبر المستخرج المدمج — كله على جهازك */
  async function importFile(file: File) {
    setError("");
    setImporting(true);
    try {
      let text: string;
      if (/\.docx$/i.test(file.name)) {
        const { docxToText } = await import("@/lib/docx");
        text = await docxToText(await file.arrayBuffer());
      } else {
        text = await file.text();
      }
      text = text.trim();
      if (!text) throw new Error("الملف فارغ أو تعذّرت قراءته");
      if (text.length > PODCAST_LIMITS.maxSourceChars) {
        text = text.slice(0, PODCAST_LIMITS.maxSourceChars);
        setError(`النص أطول من الحد — أخذنا أول ${PODCAST_LIMITS.maxSourceChars} حرف`);
      }
      setSourceText(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّرت قراءة الملف");
    } finally {
      setImporting(false);
    }
  }

  async function writeEpisode() {
    if (source === "topic" ? !topic.trim() : !sourceText.trim()) return;
    setError("");
    setResult(null);
    setWriting(true);
    try {
      const res = await fetch("/api/podcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          topic,
          length,
          tone,
          dialect,
          ...(source === "text" && { sourceText }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر إعداد الحلقة");
      setScript(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setWriting(false);
    }
  }

  async function produce() {
    if (!script) return;
    setError("");
    setRendering(true);
    try {
      const res = await fetch("/api/drama/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ ...script, introMusic }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر إنتاج الحلقة");
      }
      const duration = res.headers.get("X-Duration") ?? "";
      const theme = res.headers.get("X-Theme") === "1";
      const blob = await res.blob();
      setResult({ url: URL.createObjectURL(blob), duration, theme });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setRendering(false);
    }
  }

  function setHostVoice(hostId: string, voiceId: string) {
    setScript((prev) =>
      prev
        ? { ...prev, characters: prev.characters.map((c) => (c.id === hostId ? { ...c, voiceId } : c)) }
        : prev
    );
  }

  /** حفظ تعديل مداخلة — راجع النص قبل الإنتاج بدل إعادة توليد الحلقة كلها */
  function saveLineEdit() {
    if (editIndex === null) return;
    const text = editText.trim();
    setScript((prev) =>
      prev && text
        ? { ...prev, lines: prev.lines.map((l, i) => (i === editIndex ? { ...l, text } : l)) }
        : prev
    );
    setEditIndex(null);
  }

  const hostName = (id: string) => script?.characters.find((c) => c.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        🎙️ البودكاست <span className="text-gradient">الذكي</span>
      </h1>
      <WaveLine className="mt-3" />
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        اكتب موضوعاً واحداً، فيؤلّف الذكاء الاصطناعي حلقة حوارية كاملة بين مقدّمَين
        بأصوات مختلفة — بمحتوى حقيقي وحوار طبيعي، جاهزة للنشر.
      </p>

      {/* الإعداد */}
      <div className="mt-8 flex flex-col gap-5">
        {/* مصدر الحلقة */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSource("topic")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              source === "topic"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border-soft text-muted hover:text-body"
            }`}
          >
            💡 من موضوع — يؤلّفها الذكاء الاصطناعي
          </button>
          <button
            onClick={() => setSource("text")}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              source === "text"
                ? "border-accent bg-accent/10 text-accent"
                : "border-border-soft text-muted hover:text-body"
            }`}
          >
            📄 من نصّي — مقالك أو سيناريوهاتك تتحول حواراً
          </button>
        </div>

        {source === "text" && (
          <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs leading-relaxed text-muted">
                ارفع ملف <strong className="text-body">TXT / MD / DOCX</strong> أو الصق نصك —
                سيحوّله المقدّمان إلى حوار مشوّق <strong className="text-body">بالتزام كامل بمضمونه</strong>،
                بلا اختراع معلومات من خارجه. (الملف يُقرأ على جهازك ولا يُرفع لأي خادم)
              </p>
              <label className="shrink-0 cursor-pointer rounded-lg border border-accent px-3 py-2 text-xs font-semibold text-accent transition-colors hover:bg-accent/10">
                {importing ? "جارٍ القراءة..." : "📁 اختر ملفاً"}
                <input
                  type="file"
                  accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              maxLength={PODCAST_LIMITS.maxSourceChars}
              placeholder="الصق نص المقال أو السيناريو هنا، أو ارفعه ملفاً..."
              className="min-h-40 w-full resize-y rounded-xl border border-border-soft bg-surface-card p-4 leading-relaxed outline-none transition-colors focus:border-accent"
            />
            <p className="text-xs text-muted">
              {sourceText.length} / {PODCAST_LIMITS.maxSourceChars} حرف
            </p>
          </div>
        )}

        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          maxLength={PODCAST_LIMITS.maxTopicChars}
          placeholder={
            source === "text"
              ? "توجيه اختياري... مثال: ركّز على الجانب العملي، واجعل الخاتمة دعوة لتجربة المنصة"
              : "موضوع الحلقة... مثال: كيف غيّر الذكاء الاصطناعي صناعة الموسيقى العربية، وما مستقبل الموسيقيين معه؟"
          }
          className={`w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-relaxed outline-none transition-colors focus:border-accent ${
            source === "text" ? "min-h-20" : "min-h-28"
          }`}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-semibold">طول الحلقة</label>
            <div className="flex flex-col gap-2">
              {LENGTHS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => setLength(l.id)}
                  className={`rounded-xl border px-3 py-2 text-start text-sm transition-colors ${
                    length === l.id ? "border-accent bg-accent/10" : "border-border-soft hover:border-accent/50"
                  }`}
                >
                  <span className="font-semibold">{l.label}</span>
                  <span className="mx-2 text-xs text-muted">{l.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">نبرة الحلقة</label>
            <div className="flex flex-col gap-2">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTone(t.id)}
                  className={`rounded-xl border px-3 py-2 text-start text-sm transition-colors ${
                    tone === t.id ? "border-accent bg-accent/10" : "border-border-soft hover:border-accent/50"
                  }`}
                >
                  <span className="font-semibold">{t.label}</span>
                  <span className="mx-2 text-xs text-muted">{t.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">لهجة الكتابة والإلقاء</label>
            <select
              value={dialect}
              onChange={(e) => setDialect(e.target.value)}
              className="w-full rounded-xl border border-border-soft bg-surface-card px-3 py-2.5 text-sm outline-none focus:border-accent"
            >
              {DIALECT_OPTIONS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              تحدد لهجة الحوار المكتوب، وتحصر أصوات المقدّمَين في اللهجة نفسها.
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
            {error}
          </p>
        )}

        <button
          onClick={writeEpisode}
          disabled={writing || (source === "topic" ? !topic.trim() : !sourceText.trim())}
          className="self-start rounded-xl bg-accent px-6 py-3 font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {writing
            ? "جارٍ إعداد الحلقة..."
            : source === "text"
              ? "✍️ حوّل نصّي إلى حلقة"
              : "✍️ اكتب الحلقة"}
        </button>
      </div>

      {/* الحلقة */}
      {script && (
        <div className="mt-10 flex flex-col gap-6">
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
            <h2 className="text-xl font-bold">{script.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{script.summary}</p>
            <p className="mt-2 text-xs text-muted">
              {script.lines.length} مداخلة · المزاج: {script.mood}
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-bold">🎤 المقدّمان</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {script.characters.map((c) => (
                <div key={c.id} className="rounded-2xl border border-border-soft bg-surface-card p-4">
                  <p className="font-bold">{c.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{c.description}</p>
                  <select
                    value={c.voiceId}
                    onChange={(e) => setHostVoice(c.id, e.target.value)}
                    className="mt-3 w-full rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                  >
                    {VOICES.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.dialect} ({v.gender === "male" ? "ذكر" : "أنثى"})
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-bold">
              📝 نص الحلقة{" "}
              <span className="text-xs font-normal text-muted">— مرّر على أي مداخلة وعدّلها قبل الإنتاج</span>
            </h3>
            <div className="max-h-96 overflow-y-auto rounded-2xl border border-border-soft bg-surface-card p-4">
              <div className="flex flex-col gap-3">
                {script.lines.map((l, i) => (
                  <div key={i} className="group flex gap-3 text-sm">
                    <span className="w-20 shrink-0 truncate font-semibold text-accent">
                      {hostName(l.characterId)}
                    </span>
                    {editIndex === i ? (
                      <div className="flex flex-1 flex-col gap-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          maxLength={600}
                          autoFocus
                          className="w-full resize-y rounded-lg border border-accent bg-surface p-2 text-sm leading-relaxed outline-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={saveLineEdit}
                            className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-surface"
                          >
                            ✓ حفظ
                          </button>
                          <button
                            onClick={() => setEditIndex(null)}
                            className="rounded-lg border border-border-soft px-3 py-1 text-xs text-muted"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : (
                      <span className="flex-1 leading-relaxed">
                        {l.text}
                        <button
                          onClick={() => {
                            setEditIndex(i);
                            setEditText(l.text);
                          }}
                          className="mx-2 text-xs text-muted opacity-0 transition-opacity hover:text-body group-hover:opacity-100"
                          title="عدّل هذه المداخلة"
                        >
                          ✏️
                        </button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={produce}
              disabled={rendering}
              className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {rendering ? `جارٍ إنتاج ${script.lines.length} مداخلة...` : "🎧 أنتج الحلقة"}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={introMusic}
                onChange={(e) => setIntroMusic(e.target.checked)}
              />
              <span>
                🎵 موسيقى افتتاح وختام{" "}
                <span className="text-xs text-muted">— ثيم آلي من مقام الحلقة يؤلَّف خصيصاً لها</span>
              </span>
            </label>
          </div>

          {result && (
            <AudioPlayer
              src={result.url}
              title={`${script.title} — ${Math.round(Number(result.duration) / 60)} دقيقة تقريباً`}
              filename={`${script.title}.mp3`}
              note={
                result.theme
                  ? "حلقة بودكاست بمقدّمَين مع ثيم افتتاح وختام مؤلَّف خصيصاً — جاهزة للنشر."
                  : "حلقة بودكاست بمقدّمَين — جاهزة للنشر على منصات البودكاست."
              }
            >
              <SaveToLibrary
                url={result.url}
                kind="tts"
                title={script.title}
                content={script.summary}
                provider="elevenlabs"
                settings={{ podcast: true, lines: script.lines.length, tone, length }}
              />
            </AudioPlayer>
          )}
        </div>
      )}
    </div>
  );
}
