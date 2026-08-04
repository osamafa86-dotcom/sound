"use client";

import { useEffect, useState } from "react";

/**
 * أزرار مشاركة عمل عبر مواقع التواصل — واتساب وإكس وفيسبوك وتيليغرام
 * ونسخ الرابط، مع ورقة المشاركة الأصلية للنظام على الأجهزة الداعمة (الجوال).
 * الرابط يُبنى بعد التحميل من أصل الموقع الفعلي فيعمل على أي نطاق.
 */
export default function ShareActions({ path, title }: { path: string; title: string }) {
  const [url, setUrl] = useState("");
  const [canNative, setCanNative] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // تأجيل القراءة لما بعد الرسم الأول — يرضي قاعدة عدم التزامن في التأثيرات
    const t = setTimeout(() => {
      setUrl(new URL(path, window.location.origin).toString());
      setCanNative(typeof navigator !== "undefined" && !!navigator.share);
    }, 0);
    return () => clearTimeout(t);
  }, [path]);

  if (!url) return null;

  const text = `${title} — منصة مقام`;
  const enc = encodeURIComponent;
  const targets = [
    { label: "واتساب", icon: "🟢", href: `https://wa.me/?text=${enc(`${text}\n${url}`)}` },
    { label: "إكس (تويتر)", icon: "𝕏", href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: "فيسبوك", icon: "📘", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: "تيليغرام", icon: "✈️", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
  ];

  const btn =
    "rounded-lg border border-border-soft px-2.5 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* متصفح قديم — الروابط المباشرة تبقى متاحة */
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canNative && (
        <button
          onClick={() => navigator.share({ title: text, url }).catch(() => {})}
          className={btn}
          title="ورقة المشاركة في جهازك"
        >
          📤 مشاركة
        </button>
      )}
      {targets.map((t) => (
        <a
          key={t.label}
          href={t.href}
          target="_blank"
          rel="noopener noreferrer"
          className={btn}
          title={`مشاركة عبر ${t.label}`}
        >
          {t.icon}
        </a>
      ))}
      <button onClick={copy} className={btn} title="نسخ رابط المشاركة">
        {copied ? "✓ نُسخ" : "🔗 نسخ"}
      </button>
    </div>
  );
}
