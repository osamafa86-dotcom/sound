"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";

type Generation = {
  id: string;
  kind: "tts" | "song" | "recording";
  title: string | null;
  content: string | null;
  voice_id: string | null;
  maqam_id: string | null;
  provider: string | null;
  created_at: string;
  url: string | null;
  is_public?: boolean | null;
};

const KIND_META: Record<Generation["kind"], { icon: string; label: string }> = {
  tts: { icon: "🎙️", label: "أصوات" },
  song: { icon: "🎼", label: "أغانٍ" },
  recording: { icon: "🎧", label: "تسجيلات" },
};

const PROVIDER_NAMES: Record<string, string> = {
  elevenlabs: "ElevenLabs",
  lyria: "Lyria 3 Pro",
  "eleven-music": "Eleven Music",
  mock: "تجريبي",
};

type UsageSummary = { monthTotal: number; byRoute: Record<string, number> };

export default function Library() {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [credits, setCredits] = useState<number | null>(null);

  // الأرشيف الموحد: فلترة بالنوع وبحث بالنص وترتيب زمني
  const [kindFilter, setKindFilter] = useState<"الكل" | Generation["kind"]>("الكل");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"new" | "old">("new");
  const [publishMsg, setPublishMsg] = useState("");

  const shown = useMemo(() => {
    const q = query.trim();
    const filtered = items.filter(
      (g) =>
        (kindFilter === "الكل" || g.kind === kindFilter) &&
        (!q || (g.title ?? "").includes(q) || (g.content ?? "").includes(q))
    );
    return sort === "new" ? filtered : [...filtered].reverse();
  }, [items, kindFilter, query, sort]);

  /** نشر عمل في المعرض العام أو سحبه — بضغطة من المكتبة */
  async function togglePublish(g: Generation) {
    const next = !g.is_public;
    setPublishMsg("");
    setItems((prev) => prev.map((i) => (i.id === g.id ? { ...i, is_public: next } : i)));
    try {
      const res = await fetch("/api/generations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: g.id, isPublic: next }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر تحديث النشر");
      }
      setPublishMsg(next ? "✓ نُشر في المعرض العام — يراه الآن كل زوار المنصة" : "أُزيل من المعرض العام");
    } catch (e) {
      setItems((prev) => prev.map((i) => (i.id === g.id ? { ...i, is_public: !next } : i)));
      setPublishMsg(e instanceof Error ? e.message : "تعذّر تحديث النشر");
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const user = supabase ? (await supabase.auth.getUser()).data.user : await Promise.resolve(null);
      if (cancelled) return;
      setSignedIn(!!user);
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const [r, u, c] = await Promise.all([
          fetch("/api/generations"),
          fetch("/api/usage"),
          fetch("/api/me/credits"),
        ]);
        const d = await r.json();
        if (!cancelled) setItems(d.generations ?? []);
        if (u.ok) {
          const us = await u.json();
          if (!cancelled) setUsage(us);
        }
        if (c.ok) {
          const cd = await c.json();
          if (!cancelled && typeof cd.balance === "number") setCredits(cd.balance);
        }
      } catch {
        /* تجاهل */
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function rate(id: string, score: number) {
    setRatings((prev) => ({ ...prev, [id]: score }));
    await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId: id, score }),
    }).catch(() => {});
  }

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/generations?id=${id}`, { method: "DELETE" }).catch(() => {});
  }

  function label(g: Generation) {
    if (g.kind === "song") {
      const maqam = MAQAMAT.find((m) => m.id === g.maqam_id);
      return maqam ? `أغنية بمقام ${maqam.name}` : "أغنية";
    }
    const voice = VOICES.find((v) => v.id === g.voice_id);
    return voice ? `صوت ${voice.name} (${voice.dialect})` : "تسجيل صوتي";
  }

  if (loading) {
    return <div className="py-24 text-center text-muted">جارٍ تحميل مكتبتك...</div>;
  }

  if (signedIn === false) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12">
        <h1 className="text-3xl font-bold">مكتبتي</h1>
        <div className="mt-10 rounded-3xl border border-dashed border-border-soft bg-surface-card/50 p-16 text-center">
          <span className="text-5xl">🔐</span>
          <h2 className="mt-4 text-xl font-bold">سجّل الدخول لترى مكتبتك</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            بحساب مجاني تُحفظ كل أعمالك تلقائياً، وتستمع إليها وتنزّلها في أي وقت من أي جهاز.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/login?mode=signup"
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-strong"
            >
              أنشئ حساباً مجانياً
            </Link>
            <Link
              href="/login"
              className="rounded-xl border border-border-soft px-5 py-2.5 text-sm font-semibold hover:border-primary"
            >
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">مكتبتي</h1>
          <p className="mt-1 text-muted">
            {items.length ? `${items.length} عمل محفوظ` : "لم تحفظ أعمالاً بعد"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/tts" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-strong">
            🎙️ صوت جديد
          </Link>
          <Link href="/songs" className="rounded-xl border border-border-soft px-4 py-2 text-sm font-semibold hover:border-gold">
            🎼 أغنية جديدة
          </Link>
        </div>
      </div>

      {usage && (
        <div className={`mt-6 grid grid-cols-2 gap-3 ${credits !== null ? "sm:grid-cols-5" : "sm:grid-cols-4"}`}>
          {[
            ...(credits !== null ? [{ icon: "⚡", label: "رصيدي من النقاط", value: credits }] : []),
            { icon: "📚", label: "أعمال محفوظة", value: items.length },
            { icon: "🎙️", label: "أصوات هذا الشهر", value: usage.byRoute.tts ?? 0 },
            { icon: "🎼", label: "أغانٍ هذا الشهر", value: usage.byRoute.songs ?? 0 },
            {
              icon: "✨",
              label: "مساعد وذكاء",
              value:
                (usage.byRoute.lyrics ?? 0) +
                (usage.byRoute.enhance ?? 0) +
                (usage.byRoute.imageBrief ?? 0),
            },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border-soft bg-surface-card p-4 text-center">
              <p className="text-2xl">{s.icon}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="mt-10 rounded-3xl border border-dashed border-border-soft bg-surface-card/50 p-16 text-center">
          <span className="text-5xl">📚</span>
          <h2 className="mt-4 text-xl font-bold">المكتبة فارغة</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            ولّد صوتاً أو أغنية، ثم اضغط «احفظ في مكتبتي» ليظهر هنا.
          </p>
        </div>
      ) : (
        <>
          {/* الأرشيف الموحد: فلاتر النوع + بحث + ترتيب */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            {(["الكل", "tts", "song", "recording"] as const).map((k) => {
              const count = k === "الكل" ? items.length : items.filter((i) => i.kind === k).length;
              if (k !== "الكل" && count === 0) return null;
              return (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    kindFilter === k
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border-soft text-muted hover:text-body"
                  }`}
                >
                  {k === "الكل" ? "الكل" : `${KIND_META[k].icon} ${KIND_META[k].label}`}
                  <span className="mx-1 opacity-70">({count})</span>
                </button>
              );
            })}
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔍 ابحث في العناوين والنصوص..."
              className="min-w-48 flex-1 rounded-xl border border-border-soft bg-surface-card px-3 py-1.5 text-sm outline-none transition-colors focus:border-primary"
            />
            <button
              onClick={() => setSort(sort === "new" ? "old" : "new")}
              className="rounded-xl border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
            >
              {sort === "new" ? "⬇ الأحدث أولاً" : "⬆ الأقدم أولاً"}
            </button>
          </div>

          {publishMsg && (
            <p className="mt-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-primary">
              {publishMsg}
            </p>
          )}

          {shown.length === 0 && (
            <p className="mt-10 text-center text-sm text-muted">
              لا نتائج تطابق البحث أو الفلتر — جرّب تعديلهما.
            </p>
          )}

          <div className="mt-5 grid gap-4">
          {shown.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border-soft bg-surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {KIND_META[g.kind]?.icon ?? "🎙️"} {g.title || label(g)}
                    {g.is_public && (
                      <span className="mx-2 rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
                        🌍 منشور في المعرض
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {new Date(g.created_at).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" })}
                    {g.provider && ` · ${PROVIDER_NAMES[g.provider] ?? g.provider}`}
                  </p>
                  {g.content && (
                    <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-muted">
                      {g.content}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => remove(g.id)}
                  className="shrink-0 rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
                >
                  حذف
                </button>
              </div>

              {g.url && <audio controls src={g.url} className="mt-4 w-full" preload="none" />}

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <span className="ms-1 text-xs text-muted">قيّم الجودة:</span>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => rate(g.id, s)}
                      className={`text-lg transition-transform hover:scale-110 ${
                        (ratings[g.id] ?? 0) >= s ? "text-gold" : "text-muted/40"
                      }`}
                      title={`${s} من 5`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => togglePublish(g)}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      g.is_public
                        ? "border-gold/50 text-gold hover:bg-gold/10"
                        : "border-border-soft text-muted hover:border-gold/50 hover:text-gold"
                    }`}
                    title={
                      g.is_public
                        ? "سحب العمل من المعرض العام"
                        : "نشر العمل في المعرض العام ليراه كل الزوار"
                    }
                  >
                    {g.is_public ? "🌍 إلغاء النشر" : "🌍 انشر في المعرض"}
                  </button>
                  {g.url && (
                    <a
                      href={g.url}
                      download
                      className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
                    >
                      ⬇ تنزيل
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        </>
      )}
    </div>
  );
}
