"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import VoiceAvatar from "@/components/VoiceAvatar";
import { VOICES, type Voice } from "@/lib/voices";
import { authHeaders } from "@/lib/supabase";

/** صوت الكتالوج مُثرى بتقييمات المستخدمين من عقل المنصة */
type CatalogVoice = Voice & { rating?: { avg: number; count: number } };

/**
 * جملة العينة — مشكّلة تشكيلاً كاملاً (التشكيل يصنع فرقاً هائلاً في سلامة النطق)
 * وتُؤدَّى بالمحرك التعبيري v3 ليظهر الصوت بأفضل حالاته من أول استماع.
 */
const SAMPLE_TEXT =
  "أَهْلًا بِكُمْ فِي مَقَام! اِسْتَمِعُوا إِلَى صَوْتِي، وَأَنَا أُحَوِّلُ كَلِمَاتِكُمْ إِلَى أَدَاءٍ حَيٍّ نَابِضٍ بِالْمَشَاعِرِ.";

export default function VoicesGallery() {
  const [voices, setVoices] = useState<CatalogVoice[]>(VOICES);
  const [dialect, setDialect] = useState("الكل");
  const [gender, setGender] = useState<"الكل" | "male" | "female">("الكل");
  const [playing, setPlaying] = useState("");
  const [loadingId, setLoadingId] = useState("");
  const [error, setError] = useState("");
  const cacheRef = useRef(new Map<string, string>());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/voices/catalog")
      .then((r) => r.json())
      .then((d) => {
        if (d?.voices?.length) setVoices(d.voices);
      })
      .catch(() => {});
    const cache = cacheRef.current;
    return () => {
      audioRef.current?.pause();
      cache.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const dialects = useMemo(() => ["الكل", ...new Set(voices.map((v) => v.dialect))], [voices]);
  const shown = useMemo(
    () =>
      voices.filter(
        (v) => (dialect === "الكل" || v.dialect === dialect) && (gender === "الكل" || v.gender === gender)
      ),
    [voices, dialect, gender]
  );

  /** عينة حية: تُولَّد مرة واحدة لكل صوت وتُعاد من الذاكرة بعدها */
  async function playSample(v: CatalogVoice) {
    if (playing === v.id) {
      audioRef.current?.pause();
      setPlaying("");
      return;
    }
    audioRef.current?.pause();
    setError("");

    let url = cacheRef.current.get(v.id);
    if (!url) {
      setLoadingId(v.id);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(await authHeaders()) },
          // المحرك التعبيري بلا أسلوب مسبق — طابع الصوت الطبيعي في أبهى صوره
          body: JSON.stringify({ text: SAMPLE_TEXT, voiceId: v.id, expressive: true, styleId: "" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "تعذّر توليد العينة");
        }
        url = URL.createObjectURL(await res.blob());
        cacheRef.current.set(v.id, url);
      } catch (e) {
        setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
        setLoadingId("");
        return;
      }
      setLoadingId("");
    }

    const audio = new Audio(url);
    audioRef.current = audio;
    audio.onended = () => setPlaying("");
    audio.onpause = () => setPlaying((p) => (p === v.id ? "" : p));
    setPlaying(v.id);
    audio.play().catch(() => setPlaying(""));
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        معرض <span className="text-gradient">الأصوات</span>
      </h1>
      <p className="mt-2 max-w-2xl leading-relaxed text-muted">
        {voices.length} صوتاً عربياً أصيلاً بمتحدثين أصليين — استمع لعينة حية من كل صوت،
        ثم انطلق به إلى الاستوديو. النجوم من تقييمات مستخدمي المنصة الحقيقية.
      </p>

      {/* الفلاتر */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {dialects.map((d) => (
          <button
            key={d}
            onClick={() => setDialect(d)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              dialect === d
                ? "border-primary bg-primary/10 text-primary"
                : "border-border-soft text-muted hover:text-body"
            }`}
          >
            {d}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-border-soft" />
        {(
          [
            { id: "الكل", label: "الجميع" },
            { id: "male", label: "👨 رجال" },
            { id: "female", label: "👩 نساء" },
          ] as const
        ).map((g) => (
          <button
            key={g.id}
            onClick={() => setGender(g.id)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              gender === g.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border-soft text-muted hover:text-body"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* البطاقات */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((v) => (
          <div
            key={v.id}
            className="flex flex-col rounded-2xl border border-border-soft bg-surface-card p-5 transition-colors hover:border-primary/40"
          >
            <div className="flex items-center gap-3">
              <VoiceAvatar id={v.id} name={v.name} size={52} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">
                  {v.name}
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-semibold text-muted">
                    {v.dialect}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {v.gender === "male" ? "👨 رجل" : "👩 امرأة"}
                  {v.rating && (
                    <span className="mx-2 text-gold" title={`من ${v.rating.count} تقييماً`}>
                      ★ {v.rating.avg.toFixed(1)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-muted">{v.tone}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => playSample(v)}
                disabled={loadingId === v.id}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 ${
                  playing === v.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border-soft hover:border-primary/50"
                }`}
              >
                {loadingId === v.id ? "جارٍ التحضير..." : playing === v.id ? "⏸ إيقاف" : "🎧 استمع لعينة"}
              </button>
              <Link
                href={`/tts?voice=${encodeURIComponent(v.id)}`}
                className="flex-1 rounded-xl bg-primary px-3 py-2 text-center text-xs font-semibold text-white transition-colors hover:bg-primary-strong"
              >
                استخدمه الآن ←
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
