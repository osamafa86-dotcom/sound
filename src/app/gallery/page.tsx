"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ShareActions from "@/components/ShareActions";
import VoiceAvatar from "@/components/VoiceAvatar";
import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";
import WaveLine from "@/components/WaveLine";

type GalleryItem = {
  id: string;
  kind: "tts" | "song" | "recording" | "image" | "video";
  title: string | null;
  content: string | null;
  voice_id: string | null;
  maqam_id: string | null;
  provider: string | null;
  created_at: string;
  url: string;
};

const KINDS = [
  { id: "الكل", label: "الكل" },
  { id: "song", label: "🎼 أغانٍ" },
  { id: "tts", label: "🎙️ أصوات" },
  { id: "recording", label: "🎧 تسجيلات" },
  { id: "image", label: "🖼️ صور" },
  { id: "video", label: "🎬 فيديو" },
] as const;

export default function PublicGallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<string>("الكل");

  useEffect(() => {
    fetch("/api/gallery")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const shown = useMemo(
    () => (kind === "الكل" ? items : items.filter((i) => i.kind === kind)),
    [items, kind]
  );

  function describe(g: GalleryItem): { icon: string; label: string; cta: string; href: string } {
    if (g.kind === "song") {
      const maqam = MAQAMAT.find((m) => m.id === g.maqam_id);
      return {
        icon: "🎼",
        label: maqam ? `أغنية بمقام ${maqam.name}` : "أغنية مولّدة",
        cta: "أنشئ أغنيتك ←",
        href: "/songs",
      };
    }
    if (g.kind === "image" || g.kind === "video") {
      return {
        icon: g.kind === "image" ? "🖼️" : "🎬",
        label: g.kind === "image" ? "صورة من ذكاء مقام" : "فيديو من ذكاء مقام",
        cta: "جرّب مساحة مقام ←",
        href: "/studio",
      };
    }
    const voice = VOICES.find((v) => v.id === g.voice_id);
    return {
      icon: g.kind === "tts" ? "🎙️" : "🎧",
      label: voice ? `بصوت ${voice.name} (${voice.dialect})` : "عمل صوتي",
      cta: "جرّب بنفسك ←",
      href: g.voice_id ? `/tts?voice=${encodeURIComponent(g.voice_id)}` : "/tts",
    };
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        معرض <span className="text-gradient">الإبداعات</span>
      </h1>
      <WaveLine className="mt-3" />
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        أعمال حقيقية أنشأها مستخدمو مقام ونشروها بأنفسهم — استمع لما يصنعه الآخرون،
        وخذ الإلهام لعملك التالي.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <button
            key={k.id}
            onClick={() => setKind(k.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              kind === k.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border-soft text-muted hover:text-body"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-24 text-center text-muted">جارٍ تحميل المعرض...</div>
      ) : shown.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border-soft bg-surface-card/50 p-16 text-center">
          <span className="text-5xl">🖼️</span>
          <h2 className="mt-4 text-xl font-bold">المعرض بانتظار أول عمل</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
            أنشئ صوتاً أو أغنية، احفظها في مكتبتك، ثم اضغط «انشر في المعرض» —
            وسيظهر عملك هنا لكل زوار المنصة.
          </p>
          <Link
            href="/tts"
            className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-strong"
          >
            ابدأ الإنشاء ←
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {shown.map((g) => {
            const d = describe(g);
            return (
              <div key={g.id} className="rounded-2xl border border-border-soft bg-surface-card p-5">
                <div className="flex items-center gap-3">
                  {g.voice_id ? (
                    <VoiceAvatar id={g.voice_id} name={VOICES.find((v) => v.id === g.voice_id)?.name ?? "؟"} size={44} />
                  ) : (
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-raised text-xl">
                      {d.icon}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{g.title || d.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {d.label} ·{" "}
                      {new Date(g.created_at).toLocaleDateString("ar", { dateStyle: "medium" })}
                    </p>
                  </div>
                </div>
                {g.content && (
                  <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{g.content}</p>
                )}
                {g.kind === "image" ? (
                  <a href={g.url} target="_blank" rel="noreferrer" title="افتح الصورة بحجمها الكامل">
                    {/* رابط موقّع مؤقت من التخزين — مكوّن الصور المحسّنة لا يخدمه */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.url} alt={g.title ?? "صورة"} className="mt-4 max-h-72 rounded-xl" />
                  </a>
                ) : g.kind === "video" ? (
                  <video controls src={g.url} className="mt-4 w-full rounded-xl" preload="metadata" />
                ) : (
                  <audio controls src={g.url} className="mt-4 w-full" preload="none" />
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <Link
                    href={d.href}
                    className="inline-block rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    {d.cta}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ShareActions path={`/share/item/${g.id}`} title={g.title || d.label} />
                    <a
                      href={`${g.url}&download`}
                      className="rounded-lg border border-border-soft px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-primary"
                      title="تنزيل الملف مباشرة لجهازك"
                    >
                      ⬇ تنزيل
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
