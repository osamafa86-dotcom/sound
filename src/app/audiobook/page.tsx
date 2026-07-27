"use client";

import { useRef, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import SaveToLibrary from "@/components/SaveToLibrary";
import { VOICES } from "@/lib/voices";
import { authHeaders } from "@/lib/supabase";
import { AUDIOBOOK_LIMITS, type BookChapter, type BookOutline } from "@/lib/audiobook/types";
import { formatDuration, toArabicDigits } from "@/lib/audiobook/outline";

type ChapterState = BookChapter & {
  include: boolean;
  status: "idle" | "rendering" | "done" | "error";
  url?: string;
  blob?: Blob;
  error?: string;
  mock?: boolean;
};

/** الأصوات مجمّعة باللهجة — كتالوج المنصة كبير فيسهّل التجميع الاختيار */
function voicesByDialect() {
  const groups = new Map<string, typeof VOICES>();
  for (const voice of VOICES) {
    const bucket = groups.get(voice.dialect);
    if (bucket) bucket.push(voice);
    else groups.set(voice.dialect, [voice]);
  }
  return [...groups.entries()];
}

export default function AudiobookStudio() {
  const [text, setText] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [outline, setOutline] = useState<BookOutline | null>(null);
  const [chapters, setChapters] = useState<ChapterState[]>([]);

  // نادية صوت فصيح دافئ موصوف في الكتالوج للكتب الصوتية — افتراض معقول للراوي
  const [voiceId, setVoiceId] = useState("v-fusha-f2");
  const [speed, setSpeed] = useState(1);
  const [stability, setStability] = useState(0.65);
  const [announceTitle, setAnnounceTitle] = useState(true);

  const [indexing, setIndexing] = useState(false);
  const [producing, setProducing] = useState(false);
  const [error, setError] = useState("");
  const cancelled = useRef(false);

  const included = chapters.filter((c) => c.include);
  const doneCount = included.filter((c) => c.status === "done").length;
  const includedChars = included.reduce((sum, c) => sum + c.chars, 0);
  const estimatedSec = Math.round(includedChars / (AUDIOBOOK_LIMITS.charsPerSecond * speed));
  const mergeable =
    doneCount > 1 &&
    doneCount === included.length &&
    included.every((c) => c.blob?.type === "audio/mpeg");

  function patch(id: string, changes: Partial<ChapterState>) {
    setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  async function readFile(file: File) {
    setError("");
    if (file.size > 4 * 1024 * 1024) {
      setError("الحد الأقصى لحجم الملف 4 ميغابايت");
      return;
    }
    const content = await file.text();
    setText(content.slice(0, AUDIOBOOK_LIMITS.maxInputChars));
    if (!bookTitle) setBookTitle(file.name.replace(/\.(txt|md|markdown)$/i, ""));
  }

  async function indexBook() {
    if (!text.trim()) return;
    setError("");
    setIndexing(true);
    try {
      const res = await fetch("/api/audiobook/outline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, title: bookTitle }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر فهرسة الكتاب");

      const book = data as BookOutline;
      setOutline(book);
      setBookTitle(book.title);
      setChapters(book.chapters.map((c) => ({ ...c, include: true, status: "idle" })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setIndexing(false);
    }
  }

  async function renderChapter(chapter: ChapterState): Promise<boolean> {
    patch(chapter.id, { status: "rendering", error: "" });
    try {
      const res = await fetch("/api/audiobook/render", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({
          text: chapter.text,
          title: chapter.title,
          voiceId,
          speed,
          stability,
          announceTitle,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر إنتاج الفصل");
      }
      const blob = await res.blob();
      patch(chapter.id, {
        status: "done",
        blob,
        url: URL.createObjectURL(blob),
        mock: res.headers.get("X-Mock") === "1",
      });
      return true;
    } catch (e) {
      patch(chapter.id, { status: "error", error: e instanceof Error ? e.message : "حدث خطأ" });
      return false;
    }
  }

  /** الإنتاج بالتسلسل: صوت واحد لكل الكتاب، والمحرك يرفض طلبين متزامنين عليه */
  async function produce() {
    setError("");
    cancelled.current = false;
    setProducing(true);
    try {
      for (const chapter of chapters) {
        if (cancelled.current) break;
        if (!chapter.include || chapter.status === "done") continue;
        const ok = await renderChapter(chapter);
        // فشل فصل لا يوقف الكتاب — يبقى معلّماً بخطئه ويمكن إعادته وحده
        if (!ok && cancelled.current) break;
      }
    } finally {
      setProducing(false);
    }
  }

  function downloadMerged() {
    const parts = included.map((c) => c.blob!).filter(Boolean);
    const merged = new Blob(parts, { type: "audio/mpeg" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(merged);
    link.download = `${bookTitle || "كتاب-صوتي"}.mp3`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        📖 استوديو <span className="text-gradient">الكتب الصوتية</span>
      </h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        الصق كتابك أو ارفع ملفه، فتُكتشف فصوله تلقائياً من عناوينه، وتُنتج فصلاً فصلاً
        بصوت راوٍ واحد — مع مراجعة كل فصل وإعادة إنتاجه وحده قبل التنزيل.
      </p>

      {/* النص */}
      <div className="mt-8 flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label className="mb-2 block text-sm font-semibold">عنوان الكتاب</label>
            <input
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              maxLength={120}
              placeholder="يُستخرج من النص تلقائياً إن تركته فارغاً"
              className="w-full rounded-xl border border-border-soft bg-surface-card px-4 py-2.5 outline-none transition-colors focus:border-accent"
            />
          </div>
          <label className="cursor-pointer rounded-xl border border-border-soft bg-surface-card px-4 py-2.5 text-center text-sm font-semibold transition-colors hover:border-accent">
            📄 ارفع ملفاً نصياً
            <input
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, AUDIOBOOK_LIMITS.maxInputChars))}
          placeholder={`الصق نص الكتاب هنا...

يكتشف الاستوديو الفصول من عناوينها: «الفصل الأول»، «# عنوان»، «المقدمة»، «الخاتمة»، أو الفواصل ---
وإن لم يجد عناوين قسّم النص إلى مقاطع متوازنة عند حدود الفقرات.`}
          className="min-h-64 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-relaxed outline-none transition-colors focus:border-accent"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
          <span>
            {toArabicDigits(text.length)} / {toArabicDigits(AUDIOBOOK_LIMITS.maxInputChars)} حرف
          </span>
          {text.trim() && (
            <span>
              مدة تقديرية للنص كاملاً:{" "}
              {formatDuration(text.length / AUDIOBOOK_LIMITS.charsPerSecond)}
            </span>
          )}
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={indexBook}
          disabled={indexing || !text.trim()}
          className="self-start rounded-xl bg-accent px-6 py-3 font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {indexing ? "جارٍ الفهرسة..." : "🔍 اكتشف الفصول"}
        </button>
      </div>

      {/* الراوي والفهرس */}
      {outline && (
        <div className="mt-10 flex flex-col gap-6">
          <div className="rounded-2xl border border-accent/40 bg-accent/5 p-5">
            <h2 className="text-xl font-bold">{bookTitle}</h2>
            <p className="mt-1 text-sm text-muted">
              {toArabicDigits(outline.chapters.length)} فصلاً ·{" "}
              {toArabicDigits(outline.totalChars)} حرف · مدة تقديرية{" "}
              {formatDuration(outline.estimatedSec)}
            </p>
            {outline.truncated && (
              <p className="mt-2 text-xs text-gold">
                ⚠️ النص أطول من الحد المسموح ({toArabicDigits(AUDIOBOOK_LIMITS.maxInputChars)} حرف)
                — أُنتج الجزء الأول منه فقط.
              </p>
            )}
          </div>

          {/* إعدادات الراوي */}
          <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
            <h3 className="mb-4 text-lg font-bold">🎙️ الراوي</h3>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">الصوت</label>
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {voicesByDialect().map(([dialect, list]) => (
                    <optgroup key={dialect} label={dialect}>
                      {list.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} — {v.tone}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <label className="mt-3 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={announceTitle}
                    onChange={(e) => setAnnounceTitle(e.target.checked)}
                    className="h-4 w-4"
                  />
                  يقرأ الراوي عنوان الفصل قبل نصه
                </label>
              </div>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-1 flex justify-between text-sm font-semibold">
                    سرعة القراءة
                    <span className="text-muted">{speed.toFixed(2)}×</span>
                  </label>
                  <input
                    type="range"
                    min={0.7}
                    max={1.2}
                    step={0.05}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="mb-1 flex justify-between text-sm font-semibold">
                    ثبات الأداء
                    <span className="text-muted">{stability.toFixed(2)}</span>
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
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    السرد الطويل يستقر عند ٠٫٦٥ فما فوق — يقلّل تذبذب النبرة بين الفصول.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* شريط الإنتاج */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={produce}
              disabled={producing || !included.length}
              className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {producing
                ? `جارٍ الإنتاج... ${toArabicDigits(doneCount)}/${toArabicDigits(included.length)}`
                : doneCount
                  ? "▶️ أكمل الفصول المتبقية"
                  : "🎧 أنتج الكتاب"}
            </button>

            {producing && (
              <button
                onClick={() => (cancelled.current = true)}
                className="rounded-xl border border-border-soft px-5 py-3.5 text-sm font-semibold transition-colors hover:border-red-400"
              >
                إيقاف بعد الفصل الحالي
              </button>
            )}

            {mergeable && (
              <button
                onClick={downloadMerged}
                className="rounded-xl border border-accent px-5 py-3.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                ⬇️ نزّل الكتاب كاملاً (ملف واحد)
              </button>
            )}

            <span className="text-sm text-muted">
              {toArabicDigits(included.length)} فصلاً مختاراً · {formatDuration(estimatedSec)} تقريباً
            </span>
          </div>

          {/* الفصول */}
          <div className="flex flex-col gap-3">
            {chapters.map((chapter, i) => (
              <div
                key={chapter.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  chapter.include ? "border-border-soft bg-surface-card" : "border-border-soft/50 opacity-50"
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    checked={chapter.include}
                    onChange={(e) => patch(chapter.id, { include: e.target.checked })}
                    className="h-4 w-4 shrink-0"
                    aria-label={`أدرج ${chapter.title}`}
                  />
                  <span className="shrink-0 text-sm font-bold text-accent">
                    {toArabicDigits(i + 1)}.
                  </span>
                  <input
                    value={chapter.title}
                    onChange={(e) => patch(chapter.id, { title: e.target.value })}
                    maxLength={120}
                    className="min-w-40 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold outline-none transition-colors hover:border-border-soft focus:border-accent"
                  />
                  <span className="shrink-0 text-xs text-muted">
                    {toArabicDigits(chapter.chars)} حرف · {formatDuration(chapter.estimatedSec / speed)}
                  </span>
                  {chapter.status === "done" && (
                    <button
                      onClick={() => renderChapter(chapter)}
                      disabled={producing}
                      className="shrink-0 rounded-lg border border-border-soft px-3 py-1 text-xs transition-colors hover:border-accent disabled:opacity-40"
                    >
                      ↻ أعد الإنتاج
                    </button>
                  )}
                  {chapter.status === "rendering" && (
                    <span className="shrink-0 text-xs text-accent">جارٍ الإنتاج...</span>
                  )}
                </div>

                {chapter.status === "error" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <p className="text-xs text-red-300">{chapter.error}</p>
                    <button
                      onClick={() => renderChapter(chapter)}
                      disabled={producing}
                      className="rounded-lg border border-red-400/50 px-3 py-1 text-xs text-red-200 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                    >
                      أعد المحاولة
                    </button>
                  </div>
                )}

                {chapter.url && (
                  <div className="mt-4">
                    <AudioPlayer
                      src={chapter.url}
                      title={chapter.title}
                      mock={chapter.mock}
                      filename={`${toArabicDigits(i + 1)} - ${chapter.title}.mp3`}
                    >
                      <SaveToLibrary
                        url={chapter.url}
                        kind="tts"
                        title={`${bookTitle} — ${chapter.title}`}
                        content={chapter.text.slice(0, 400)}
                        voiceId={voiceId}
                        provider="elevenlabs"
                        settings={{ audiobook: true, chapter: chapter.title, book: bookTitle, speed, stability }}
                      />
                    </AudioPlayer>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
