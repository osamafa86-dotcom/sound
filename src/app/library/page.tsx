"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AudioPlayer from "@/components/AudioPlayer";
import { listLibrary, removeFromLibrary, type LibraryItem } from "@/lib/library";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

const KIND_LABELS = { tts: "🎙️ نص إلى صوت", song: "🎼 أغنية" } as const;

export default function Library() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const supabase = getSupabase();
        let signed = false;
        if (supabase) {
          const { data } = await supabase.auth.getUser();
          signed = !!data.user;
        }
        const loaded = await listLibrary();
        if (cancelled) return;
        setSignedIn(signed);
        setItems(loaded);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "تعذّر تحميل المكتبة");
        setItems([]);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function remove(item: LibraryItem) {
    try {
      await removeFromLibrary(item);
      setItems((prev) => (prev ? prev.filter((i) => i.id !== item.id) : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الحذف");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">مكتبتي</h1>
          <p className="mt-2 text-muted">كل ما ولّدته وحفظته من أصوات وأغانٍ.</p>
        </div>
        {supabaseConfigured && !signedIn && (
          <Link
            href="/login"
            className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            سجّل الدخول للمزامنة السحابية
          </Link>
        )}
      </div>

      {!supabaseConfigured && (
        <p className="mt-6 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-muted">
          الحفظ حالياً <span className="font-semibold text-gold">محلي في هذا المتصفح</span> — لتفعيل الحسابات
          والمكتبة السحابية أضف مفاتيح Supabase (راجع README).
        </p>
      )}

      {error && (
        <p className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {items === null ? (
        <p className="mt-12 text-center text-muted">جارٍ تحميل المكتبة...</p>
      ) : items.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-border-soft bg-surface-card/50 p-16 text-center">
          <span className="text-5xl">📚</span>
          <h2 className="mt-4 text-xl font-bold">المكتبة فارغة حالياً</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            ولّد صوتاً أو أغنية ثم اضغط «حفظ في مكتبتي» لتجدها هنا وتعود إليها في أي وقت.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/tts" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-strong">
              النص إلى صوت
            </Link>
            <Link href="/songs" className="rounded-xl border border-border-soft px-5 py-2.5 text-sm font-semibold hover:border-gold">
              استوديو الأغاني
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <div key={`${item.source}-${item.id}`} className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  {KIND_LABELS[item.kind]}
                  <span className="mx-2 rounded-full bg-surface-card px-2 py-0.5">
                    {item.source === "cloud" ? "☁️ سحابي" : "💾 محلي"}
                  </span>
                  {new Date(item.createdAt).toLocaleString("ar")}
                </span>
                <button
                  onClick={() => remove(item)}
                  className="rounded-lg border border-border-soft px-2.5 py-1 transition-colors hover:border-red-400 hover:text-red-300"
                >
                  🗑 حذف
                </button>
              </div>
              <AudioPlayer
                src={item.url}
                title={item.title}
                filename={`${item.title || "maqam"}.${item.mimeType === "audio/mpeg" ? "mp3" : "wav"}`}
                note={item.details || undefined}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
