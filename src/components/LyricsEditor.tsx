"use client";

import { useEffect, useRef, useState } from "react";
import { buildLrc, buildSrt, sectionIndexFromStarts, type KaraokeWord } from "@/lib/karaoke";
import { SECTION_LABELS, sectionIndexAtTime, type SongSection } from "@/lib/songSections";

/** يقصّ علامات الترقيم من طرفي الكلمة المفرّغة ويبقي الحروف والتشكيل */
function cleanWord(text: string): string {
  return text.replace(/^[^\p{L}\p{N}\p{M}]+|[^\p{L}\p{N}\p{M}]+$/gu, "");
}

/**
 * محرر النص والصوت — الكلمات تضيء لحظة غنائها، وكل كلمة قابلة للضغط:
 * اسمعها وحدها، صحح نطقها في مكانها، ويُعاد إنشاد مقطعها فقط
 * (استيراد باقي المقاطع كما هي) بدل إعادة تلحين الأغنية كاملة.
 */
export default function LyricsEditor({
  words,
  activeIndex,
  title,
  sections,
  sectionStarts,
  canInpaint,
  busy,
  onPlayWord,
  onFix,
}: {
  words: KaraokeWord[];
  activeIndex: number;
  title?: string;
  sections: SongSection[] | null;
  /** بدايات المقاطع المقيسة من التفريغ — تتقدم على المدد المخططة عند توفرها */
  sectionStarts?: number[] | null;
  /** إعادة إنشاد المقطع وحده متاحة (بنية مقاطع + معرّف المحرك + نسخة كاملة فعلية) */
  canInpaint: boolean;
  /** الصفحة الأم منشغلة بتوليد — يجمّد التصحيح */
  busy: boolean;
  onPlayWord: (word: KaraokeWord) => void;
  /** تعليم النطق وإعادة الإنشاد — يرمي خطأً عند الفشل ليعرضه المحرر */
  onFix: (args: { wrong: string; alias: string; sectionIndex: number }) => Promise<void>;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const [selected, setSelected] = useState(-1);
  const [wrong, setWrong] = useState("");
  const [alias, setAlias] = useState("");
  const [fixBusy, setFixBusy] = useState(false);
  const [fixError, setFixError] = useState("");

  useEffect(() => {
    // إبقاء الكلمة المُغنّاة في مرمى النظر — إلا أثناء التصحيح كي لا يهرب المحرر
    if (selected === -1) {
      activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [activeIndex, selected]);

  function download(content: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function pick(i: number) {
    setSelected(i);
    setWrong(cleanWord(words[i].text));
    setAlias("");
    setFixError("");
    onPlayWord(words[i]);
  }

  const sectionIdx =
    selected >= 0 && sections?.length
      ? sectionStarts?.length === sections.length
        ? sectionIndexFromStarts(sectionStarts, words[selected].start)
        : sectionIndexAtTime(sections, words[selected].start)
      : -1;
  const sectionLabel =
    sectionIdx >= 0 && sections ? `${SECTION_LABELS[sections[sectionIdx].kind]} ${sectionIdx + 1}` : "";
  const inpaintHere = canInpaint && sectionIdx >= 0;

  // مطابقة الغناء للنص المكتوب — من أعلام المحاذاة (كاشف انحراف المحرك)
  const judged = words.filter((w) => w.matched !== undefined);
  const adherence = judged.length
    ? Math.round((judged.filter((w) => w.matched).length / judged.length) * 100)
    : null;

  async function submit() {
    if (!wrong.trim() || !alias.trim() || fixBusy || busy) return;
    setFixBusy(true);
    setFixError("");
    try {
      await onFix({ wrong: wrong.trim(), alias: alias.trim(), sectionIndex: sectionIdx });
      setSelected(-1);
    } catch (e) {
      setFixError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setFixBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-gold/40 bg-surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">📝 محرر النص والصوت — الكلمات تضيء مع الغناء</h3>
        <div className="flex gap-2">
          <button
            onClick={() => download(buildSrt(words), "maqam-lyrics.srt")}
            title="ملف ترجمة للمونتاج والريلز"
            className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
          >
            ⬇ SRT
          </button>
          <button
            onClick={() => download(buildLrc(words, title), "maqam-lyrics.lrc")}
            title="ملف كلمات لمشغلات الموسيقى"
            className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
          >
            ⬇ LRC
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">
        اضغط أي كلمة لتسمعها وحدها وتصحح نطقها في مكانها — سمعتها خطأ؟ عدّلها ويُعاد إنشاد
        مقطعها فقط.
        {adherence !== null && adherence < 100 && (
          <>
            {" "}
            <span
              className="rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold"
              title="نسبة كلمات الغناء المسموع المطابقة لنصك المكتوب — المخالفة تحتها نقاط"
            >
              مطابقة الغناء للنص: {adherence}٪
            </span>{" "}
            الكلمات المنقّطة غُنّيت مختلفة عن نصك (انحراف من المحرك أو خطأ سمع من التفريغ)
            — اضغطها لتصحيحها.
          </>
        )}
      </p>

      <p dir="rtl" className="mt-3 max-h-56 overflow-y-auto text-lg leading-loose">
        {words.map((w, i) => (
          <span key={i}>
            <button
              ref={i === activeIndex ? activeRef : undefined}
              onClick={() => pick(i)}
              disabled={busy || fixBusy}
              title={
                w.matched === false
                  ? "غُنّيت مختلفة عن النص المكتوب — اضغط لسماعها وتصحيحها"
                  : "اسمعها وصحح نطقها"
              }
              className={`rounded px-0.5 transition-colors disabled:cursor-default ${
                w.matched === false ? "underline decoration-dotted decoration-gold underline-offset-4" : ""
              } ${
                i === selected
                  ? "bg-primary/15 font-bold text-primary ring-1 ring-primary"
                  : i === activeIndex
                    ? "bg-gold/20 font-bold text-gold"
                    : i < activeIndex
                      ? "text-body hover:bg-rose"
                      : "text-muted/60 hover:bg-rose hover:text-body"
              }`}
            >
              {w.text}
            </button>{" "}
          </span>
        ))}
      </p>

      {selected >= 0 && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              🩹 تصحيح «{cleanWord(words[selected].text)}»
              {sectionLabel && (
                <span className="ms-2 rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">
                  في {sectionLabel}
                </span>
              )}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onPlayWord(words[selected])}
                className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
              >
                ▶ اسمعها مجدداً
              </button>
              <button
                onClick={() => setSelected(-1)}
                disabled={fixBusy}
                className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body disabled:opacity-50"
              >
                ✕ إغلاق
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={wrong}
              onChange={(e) => setWrong(e.target.value)}
              maxLength={100}
              title="عدّلها لتطابق الكلمة كما هي مكتوبة في نصك إن اختلفت عن المسموع"
              placeholder="الكلمة كما كُتبت"
              className="w-40 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <span className="text-muted">←</span>
            <input
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              maxLength={200}
              placeholder="نطقها الصحيح مشكّلاً، مثل: مَدْرَسِة"
              autoFocus
              className="w-56 rounded-xl border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            <button
              onClick={submit}
              disabled={fixBusy || busy || !wrong.trim() || !alias.trim()}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {fixBusy || busy
                ? "جارٍ التعليم والإنشاد..."
                : inpaintHere
                  ? `🧠 علّم وأعد إنشاد ${sectionLabel} وحده`
                  : "🧠 علّم وولّد نسخة مصححة"}
            </button>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-muted">
            {inpaintHere
              ? "يتعلم العقل النطق الصحيح للأبد، ثم يُعاد إنشاد هذا المقطع وحده — باقي الأغنية يبقى كما هو حرفياً."
              : "يتعلم العقل النطق الصحيح للأبد، وتُولَّد نسخة كاملة مصححة (إعادة الإنشاد الجزئي تتطلب بنية مقاطع ونسخة كاملة من محرك Eleven Music)."}
          </p>
          {fixError && (
            <p className="mt-2 rounded-lg border border-primary/40 bg-rose px-3 py-2 text-xs text-primary-strong">
              {fixError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
