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
};

const PROVIDER_NAMES: Record<string, string> = {
  elevenlabs: "ElevenLabs",
  lyria: "Lyria 3 Pro",
  "eleven-music": "Eleven Music",
  mock: "تجريبي",
};

export default function Library() {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      const isIn = !!data.user;
      setSignedIn(isIn);
      if (!isIn) {
        setLoading(false);
        return;
      }
      fetch("/api/generations")
        .then((r) => r.json())
        .then((d) => setItems(d.generations ?? []))
        .catch(() => {})
        .finally(() => setLoading(false));
    });
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
          ))}
        </div>
      )}
    </div>
  );
}
