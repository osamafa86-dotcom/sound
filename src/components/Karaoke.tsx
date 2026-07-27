"use client";

import { useEffect, useRef } from "react";
import { buildLrc, buildSrt, type KaraokeWord } from "@/lib/karaoke";

/** عرض كاريوكي: الكلمات تضيء لحظة غنائها، مع تصدير SRT/LRC للمونتاج */
export default function Karaoke({
  words,
  activeIndex,
  title,
}: {
  words: KaraokeWord[];
  activeIndex: number;
  title?: string;
}) {
  const activeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  function download(content: string, filename: string) {
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">🎤 كاريوكي — الكلمات تضيء مع الغناء</h3>
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
      <p className="mt-3 max-h-56 overflow-y-auto text-lg leading-loose">
        {words.map((w, i) => (
          <span
            key={i}
            ref={i === activeIndex ? activeRef : undefined}
            className={
              i === activeIndex
                ? "rounded bg-gold/20 font-bold text-gold transition-colors"
                : i < activeIndex
                  ? "text-body"
                  : "text-muted/60"
            }
          >
            {w.text}{" "}
          </span>
        ))}
      </p>
    </div>
  );
}
