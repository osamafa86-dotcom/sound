"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";

type Generation = {
  id: string;
  kind: "tts" | "song";
  title: string | null;
  content: string | null;
  voice_id: string | null;
  maqam_id: string | null;
  provider: string | null;
  created_at: string;
  url: string | null;
  share_id: string | null;
  is_public: boolean | null;
  /** رابط المشاركة الكامل — يبنيه الخادم لأنه وحده يعرف أصل الموقع */
  share_url: string | null;
};

type FacebookPage = { pageId: string; name: string; category: string | null };

/** رسائل نتيجة الربط كما يعيدها مسار العودة من فيسبوك */
const CONNECT_MESSAGES: Record<string, string> = {
  connected: "✓ رُبطت صفحاتك بنجاح — يمكنك النشر الآن",
  cancelled: "أُلغيت الموافقة من فيسبوك",
  nopages: "لم نجد صفحة تديرها بهذا الحساب — أنشئ صفحة على فيسبوك ثم أعد الربط",
  unavailable: "النشر على فيسبوك غير مفعّل على هذا الخادم",
  failed: "تعذّر الربط مع فيسبوك",
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

  const [fbConfigured, setFbConfigured] = useState(false);
  const [fbPages, setFbPages] = useState<FacebookPage[]>([]);
  const [fbNotice, setFbNotice] = useState("");
  const [shareLinks, setShareLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string>("");
  const [posted, setPosted] = useState<Record<string, string>>({});
  const [itemError, setItemError] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const user = supabase ? (await supabase.auth.getUser()).data.user : await Promise.resolve(null);
      if (cancelled) return;
      setSignedIn(!!user);

      // نتيجة العودة من نافذة موافقة فيسبوك تصل كمعامل في الرابط ثم يُنظَّف
      const params = new URLSearchParams(window.location.search);
      const status = params.get("facebook");
      if (status) {
        const reason = params.get("reason");
        setFbNotice(
          (CONNECT_MESSAGES[status] ?? CONNECT_MESSAGES.failed) + (reason ? ` — ${reason}` : "")
        );
        window.history.replaceState({}, "", window.location.pathname);
      }

      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const [r, u, f] = await Promise.all([
          fetch("/api/generations"),
          fetch("/api/usage"),
          fetch("/api/facebook/pages"),
        ]);
        const d = await r.json();
        if (!cancelled) setItems(d.generations ?? []);
        if (u.ok) {
          const us = await u.json();
          if (!cancelled) setUsage(us);
        }
        if (f.ok) {
          const fb = await f.json();
          if (!cancelled) {
            setFbConfigured(!!fb.configured);
            setFbPages(fb.pages ?? []);
          }
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

  function fail(id: string, message: string) {
    setItemError((prev) => ({ ...prev, [id]: message }));
  }

  /** تفعيل أو إلغاء الرابط العام لعمل واحد */
  async function toggleShare(g: Generation) {
    const enabled = !g.is_public;
    setBusy(g.id);
    setItemError((prev) => ({ ...prev, [g.id]: "" }));
    try {
      const res = await fetch("/api/generations/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: g.id, enabled }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تغيير المشاركة");

      setItems((prev) =>
        prev.map((i) => (i.id === g.id ? { ...i, is_public: enabled, share_id: data.shareId } : i))
      );
      setShareLinks((prev) => ({ ...prev, [g.id]: data.url ?? "" }));
    } catch (e) {
      fail(g.id, e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusy("");
    }
  }

  /** النشر على صفحة — يفعّل الرابط العام تلقائياً لأن المنشور رابط لا ملف */
  async function publishToPage(g: Generation, pageId: string) {
    setBusy(g.id);
    setItemError((prev) => ({ ...prev, [g.id]: "" }));
    try {
      const res = await fetch("/api/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationId: g.id, pageId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر النشر");

      setItems((prev) => prev.map((i) => (i.id === g.id ? { ...i, is_public: true } : i)));
      setPosted((prev) => ({ ...prev, [g.id]: data.permalink }));
    } catch (e) {
      fail(g.id, e instanceof Error ? e.message : "حدث خطأ");
    } finally {
      setBusy("");
    }
  }

  async function disconnectPage(pageId: string) {
    setFbPages((prev) => prev.filter((p) => p.pageId !== pageId));
    await fetch(`/api/facebook/pages?pageId=${encodeURIComponent(pageId)}`, {
      method: "DELETE",
    }).catch(() => {});
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
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
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

      {fbNotice && (
        <p className="mt-6 rounded-xl border border-border-soft bg-surface-card px-4 py-3 text-sm">
          {fbNotice}
        </p>
      )}

      {/* ربط صفحات فيسبوك — يظهر فقط عندما يكون التطبيق مضبوطاً على الخادم */}
      {fbConfigured && (
        <div className="mt-6 rounded-2xl border border-border-soft bg-surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">📘 النشر على فيسبوك</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                {fbPages.length
                  ? `${fbPages.length} صفحة مربوطة — انشر أي عمل عليها من بطاقته أدناه.`
                  : "اربط صفحتك مرة واحدة، ثم انشر أعمالك عليها بضغطة."}
              </p>
            </div>
            <a
              href="/api/facebook/login"
              className="rounded-xl bg-[#1877F2] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {fbPages.length ? "أعد الربط / أضف صفحة" : "اربط صفحة فيسبوك"}
            </a>
          </div>

          {fbPages.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {fbPages.map((p) => (
                <span
                  key={p.pageId}
                  className="flex items-center gap-2 rounded-full border border-border-soft bg-surface px-3 py-1.5 text-xs"
                >
                  {p.name}
                  <button
                    onClick={() => disconnectPage(p.pageId)}
                    title="فكّ الربط"
                    className="text-muted transition-colors hover:text-red-400"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
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
        <div className="mt-8 grid gap-4">
          {items.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border-soft bg-surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">
                    {g.kind === "song" ? "🎼" : "🎙️"} {g.title || label(g)}
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => toggleShare(g)}
                    disabled={busy === g.id}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                      g.is_public
                        ? "border-accent text-accent"
                        : "border-border-soft text-muted hover:text-body"
                    }`}
                  >
                    {g.is_public ? "🌐 مُشارك — ألغِ المشاركة" : "🔗 شارك برابط عام"}
                  </button>

                  {fbConfigured && fbPages.length > 0 && (
                    <select
                      value=""
                      disabled={busy === g.id}
                      onChange={(e) => e.target.value && publishToPage(g, e.target.value)}
                      className="rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-xs outline-none focus:border-accent disabled:opacity-40"
                    >
                      <option value="">📘 انشر على صفحة...</option>
                      {fbPages.map((p) => (
                        <option key={p.pageId} value={p.pageId}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}

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

              {(g.is_public || itemError[g.id] || posted[g.id]) && (
                <div className="mt-3 flex flex-col gap-2 border-t border-border-soft pt-3 text-xs">
                  {g.is_public && (shareLinks[g.id] || g.share_id) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        readOnly
                        value={shareLinks[g.id] || g.share_url || ""}
                        onFocus={(e) => e.currentTarget.select()}
                        className="min-w-0 flex-1 rounded-lg border border-border-soft bg-surface px-3 py-1.5 text-muted outline-none"
                      />
                      <a
                        href={`/s/${g.share_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-border-soft px-3 py-1.5 transition-colors hover:border-accent"
                      >
                        افتح
                      </a>
                    </div>
                  )}
                  {posted[g.id] && (
                    <a
                      href={posted[g.id]}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent hover:underline"
                    >
                      ✓ نُشر على فيسبوك — افتح المنشور
                    </a>
                  )}
                  {itemError[g.id] && <p className="text-red-300">{itemError[g.id]}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
