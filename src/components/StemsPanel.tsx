"use client";

import { useEffect, useRef, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import { authHeaders } from "@/lib/supabase";

type StemState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "ready"; url: string }
  | { status: "error"; message: string };

/**
 * فصل المسارات — من الأغنية المولّدة إلى مسارين مستقلين:
 * الغناء وحده (أكابيلا) عبر عازل ElevenLabs على الخادم،
 * والنسخة الآلية بإلغاء القناة الوسطى محلياً في المتصفح (فورية وبلا كلفة).
 */
export default function StemsPanel({ song }: { song: { blob: Blob; title: string } }) {
  const [vocals, setVocals] = useState<StemState>({ status: "idle" });
  const [instrumental, setInstrumental] = useState<StemState>({ status: "idle" });
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  function keepUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  }

  async function makeVocals() {
    if (vocals.status === "busy") return;
    setVocals({ status: "busy" });
    try {
      const fd = new FormData();
      fd.append("audio", song.blob, "song.mp3");
      const res = await fetch("/api/isolate", {
        method: "POST",
        headers: await authHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر عزل الغناء");
      }
      setVocals({ status: "ready", url: keepUrl(await res.blob()) });
    } catch (e) {
      setVocals({ status: "error", message: e instanceof Error ? e.message : "حدث خطأ غير متوقع" });
    }
  }

  async function makeInstrumental() {
    if (instrumental.status === "busy") return;
    setInstrumental({ status: "busy" });
    try {
      const { extractInstrumental } = await import("@/lib/stems");
      setInstrumental({ status: "ready", url: keepUrl(await extractInstrumental(song.blob)) });
    } catch (e) {
      setInstrumental({
        status: "error",
        message: e instanceof Error ? e.message : "تعذّرت المعالجة في هذا المتصفح",
      });
    }
  }

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
      <p className="text-sm font-semibold">🎚️ فصل المسارات (Stems)</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        استخرج من أغنيتك مسارين مستقلين: الغناء وحده (أكابيلا) لإعادة توزيعه، أو الموسيقى بلا
        غناء لتغني عليها بنفسك أو تستخدمها خلفيةً.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={makeVocals}
          disabled={vocals.status === "busy" || vocals.status === "ready"}
          title="عزل الغناء عن الموسيقى عبر محرك ElevenLabs"
          className="rounded-xl border border-primary px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
        >
          {vocals.status === "ready"
            ? "✓ الغناء جاهز"
            : vocals.status === "busy"
              ? "جارٍ عزل الغناء..."
              : "🎤 الغناء وحده (أكابيلا)"}
        </button>
        <button
          onClick={makeInstrumental}
          disabled={instrumental.status === "busy" || instrumental.status === "ready"}
          title="معالجة فورية في متصفحك بإلغاء القناة الوسطى — بلا أي كلفة"
          className="rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 disabled:opacity-50"
        >
          {instrumental.status === "ready"
            ? "✓ النسخة الآلية جاهزة"
            : instrumental.status === "busy"
              ? "جارٍ استخلاص الموسيقى..."
              : "🎼 الموسيقى بلا غناء"}
        </button>
      </div>

      {vocals.status === "error" && (
        <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-2.5 text-xs text-primary-strong">
          {vocals.message}
        </p>
      )}
      {instrumental.status === "error" && (
        <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-2.5 text-xs text-primary-strong">
          {instrumental.message}
        </p>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {vocals.status === "ready" && (
          <AudioPlayer
            src={vocals.url}
            title={`«${song.title}» — الغناء وحده`}
            filename="maqam-vocals.mp3"
          />
        )}
        {instrumental.status === "ready" && (
          <AudioPlayer
            src={instrumental.url}
            title={`«${song.title}» — النسخة الآلية`}
            filename="maqam-instrumental.wav"
            note="استخلاص تقريبي بإلغاء القناة الوسطى مع الإبقاء على الباص — قد يبقى أثر خافت من الغناء حسب توزيع المزيج."
          />
        )}
      </div>
    </div>
  );
}
