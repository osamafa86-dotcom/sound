"use client";

import { useState } from "react";
import { SUNO_CREATE_URL, type SunoPackage } from "@/lib/sunoPackage";

/**
 * لوحة التسليم إلى Suno: كل حقل من حقول وضع Custom بزر نسخ خاص،
 * وزر يفتح صفحة الإنشاء هناك — المستخدم يلصق ويولّد بحسابه هو.
 */
export default function SunoHandoff({
  pkg,
  compact = false,
}: {
  pkg: SunoPackage;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState("");

  async function copy(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? "" : k)), 2000);
    } catch {
      /* متصفح بلا حافظة — النص ظاهر ويمكن تحديده يدوياً */
    }
  }

  const fields: { key: string; label: string; hint: string; value: string; rows: number }[] = [
    { key: "lyrics", label: "Lyrics", hint: "الكلمات المشكّلة بعلامات المقاطع", value: pkg.lyrics, rows: compact ? 4 : 8 },
    { key: "style", label: "Style of Music", hint: "برومبت الأسلوب: المقام واللهجة والآلات", value: pkg.style, rows: compact ? 3 : 4 },
    { key: "title", label: "Title", hint: "العنوان", value: pkg.title, rows: 1 },
    { key: "exclude", label: "Exclude Styles", hint: "ما يُستبعد (من خيارات More Options)", value: pkg.exclude, rows: 1 },
  ];

  return (
    <div className="nodrag nowheel flex flex-col gap-2" dir="rtl">
      <ol className="list-inside list-decimal text-[11px] leading-relaxed text-muted">
        <li>افتح Suno واختر وضع <b>Custom</b></li>
        <li>انسخ كل حقل والصقه في خانته المطابقة لاسمه</li>
        <li>ولّد، ثم نزّل الأغنية التي تعجبك وأعدها إلى مقام</li>
      </ol>

      {fields.map((f) => (
        <div key={f.key} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold">
              <span dir="ltr">{f.label}</span>
              <span className="mx-1 font-normal text-muted">— {f.hint}</span>
            </span>
            <button
              onClick={() => copy(f.key, f.value)}
              className="shrink-0 rounded-full border border-border-soft px-2.5 py-1 text-[10px] font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              {copied === f.key ? "✓ نُسخ" : "نسخ"}
            </button>
          </div>
          <textarea
            readOnly
            value={f.value}
            rows={f.rows}
            dir={f.key === "lyrics" || f.key === "title" ? "rtl" : "ltr"}
            className="w-full resize-y rounded-lg border border-border-soft bg-surface p-2 text-[11px] leading-relaxed outline-none"
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ))}

      <a
        href={SUNO_CREATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-xl bg-[#0f0f10] px-4 py-2 text-center text-xs font-bold text-white transition-opacity hover:opacity-85"
      >
        افتح Suno ←
      </a>
    </div>
  );
}
