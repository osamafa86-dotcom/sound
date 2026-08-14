"use client";

import { useEffect, useState } from "react";

/**
 * أزرار مشاركة عمل عبر مواقع التواصل بشعاراتها الرسمية وألوان علاماتها —
 * واتساب وإكس وفيسبوك وتيليغرام ونسخ الرابط، مع ورقة المشاركة الأصلية
 * للنظام على الأجهزة الداعمة (الجوال). الشعارات SVG مدمجة بلا أي تحميل خارجي.
 */

/** مسارات الشعارات الرسمية (Simple Icons، رخصة حرة) على شبكة 24×24 */
const BRANDS = [
  {
    label: "واتساب",
    color: "#25D366",
    path: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z",
  },
  {
    label: "إكس (تويتر)",
    color: "#0f1419",
    path: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
  },
  {
    label: "فيسبوك",
    color: "#1877F2",
    path: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
  {
    label: "تيليغرام",
    color: "#26A5E4",
    path: "M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z",
  },
] as const;

function shareHref(brand: (typeof BRANDS)[number]["label"], url: string, text: string): string {
  const enc = encodeURIComponent;
  switch (brand) {
    case "واتساب":
      return `https://wa.me/?text=${enc(`${text}\n${url}`)}`;
    case "إكس (تويتر)":
      return `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`;
    case "فيسبوك":
      return `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`;
    default:
      return `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`;
  }
}

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

  const text = `${title} — منصة لحّن`;
  const pill =
    "flex items-center gap-1 rounded-full border border-border-soft px-2.5 py-1.5 text-xs transition-colors hover:border-primary hover:text-primary";

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
      {BRANDS.map((b) => (
        <a
          key={b.label}
          href={shareHref(b.label, url, text)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-transform hover:scale-110"
          style={{ background: b.color }}
          title={`مشاركة عبر ${b.label}`}
          aria-label={`مشاركة عبر ${b.label}`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#fff" aria-hidden>
            <path d={b.path} />
          </svg>
        </a>
      ))}
      {canNative && (
        <button
          onClick={() => navigator.share({ title: text, url }).catch(() => {})}
          className={pill}
          title="ورقة المشاركة في جهازك"
        >
          {/* أيقونة المشاركة (عقد متصلة) */}
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
          </svg>
          مشاركة
        </button>
      )}
      <button onClick={copy} className={pill} title="نسخ رابط المشاركة">
        {/* أيقونة رابط */}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
        {copied ? "✓ نُسخ" : "نسخ"}
      </button>
    </div>
  );
}
