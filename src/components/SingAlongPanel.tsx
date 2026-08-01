"use client";

import { useEffect, useRef, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import SaveToLibrary from "@/components/SaveToLibrary";
import { authHeaders } from "@/lib/supabase";

type Phase = "idle" | "preparing" | "recording" | "recorded" | "mixing" | "mixed";

/**
 * غنِّ بصوتك على اللحن المولّد — يعزف النسخة الآلية ويسجّل صوتك معها،
 * ثم يمزجهما محلياً في متصفحك: كسب للصوت، تعويض تأخير التسجيل،
 * وتنقية اختيارية عبر عازل الاستوديو. الناتج WAV يُحفظ في مكتبتك.
 */
export default function SingAlongPanel({
  song,
  isInstrumental,
  maqamId,
  styleId,
}: {
  song: { blob: Blob; title: string };
  /** الأغنية أصلاً آلية — تُستخدم كما هي بلا استخلاص */
  isInstrumental: boolean;
  maqamId: string;
  styleId: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [vocalUrl, setVocalUrl] = useState("");
  const [mixUrl, setMixUrl] = useState("");
  const [limited, setLimited] = useState(false);

  // إعدادات المزج — تبقى قابلة للتعديل بعد المزج لإعادة مزج فورية
  const [gainPct, setGainPct] = useState(140);
  const [advanceMs, setAdvanceMs] = useState(120);
  const [cleanVoice, setCleanVoice] = useState(false);

  const instRef = useRef<{ blob: Blob; url: string } | null>(null);
  const vocalRef = useRef<Blob | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      playerRef.current?.pause();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  function keepUrl(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    urlsRef.current.push(url);
    return url;
  }

  /** اللحن الذي سيُغنّى عليه: الأغنية نفسها إن كانت آلية، وإلا نسختها الآلية */
  async function ensureInstrumental(): Promise<{ blob: Blob; url: string }> {
    if (instRef.current) return instRef.current;
    let blob = song.blob;
    if (!isInstrumental) {
      const { extractInstrumental } = await import("@/lib/stems");
      blob = await extractInstrumental(song.blob);
    }
    instRef.current = { blob, url: keepUrl(blob) };
    return instRef.current;
  }

  async function start() {
    if (phase === "preparing" || phase === "recording") return;
    setError("");
    setNotice("");
    setPhase("preparing");
    try {
      if (typeof MediaRecorder === "undefined") {
        throw new Error("متصفحك لا يدعم التسجيل — جرّب أحدث Chrome أو Safari");
      }
      const inst = await ensureInstrumental();
      // بلا معالجات المكالمات (إلغاء صدى/ضجيج): وفاء أعلى للغناء عبر السماعات
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        vocalRef.current = blob;
        setVocalUrl(keepUrl(blob));
        setPhase("recorded");
      };
      recorderRef.current = recorder;

      const player = new Audio(inst.url);
      player.onended = () => stop();
      playerRef.current = player;

      recorder.start();
      // معايرة الكمون تلقائياً: الفارق بين بدء التسجيل وبدء العزف الفعلي
      // + كمون إخراج الجهاز — بدل ترك المستخدم يخمّن قيمة التزامن
      const recStartedAt = performance.now();
      player.addEventListener(
        "playing",
        () => {
          const delta = performance.now() - recStartedAt;
          let outputMs = 60;
          try {
            const Ctx =
              window.AudioContext ??
              (window as unknown as { webkitAudioContext: typeof AudioContext })
                .webkitAudioContext;
            const ctx = new Ctx();
            const latency =
              (ctx as AudioContext & { outputLatency?: number }).outputLatency ??
              ctx.baseLatency ??
              0.06;
            outputMs = Math.round(latency * 1000);
            ctx.close().catch(() => {});
          } catch {
            // بيئة بلا AudioContext — يبقى التقدير الافتراضي
          }
          setAdvanceMs(Math.min(400, Math.max(0, Math.round(delta) + outputMs)));
        },
        { once: true }
      );
      await player.play();
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
      setPhase("recording");
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      playerRef.current?.pause();
      setPhase("idle");
      setError(
        e instanceof Error && e.message.includes("متصفح")
          ? e.message
          : "تعذّر بدء التسجيل — تأكد من منح إذن الميكروفون في المتصفح"
      );
    }
  }

  function stop() {
    if (timerRef.current) clearInterval(timerRef.current);
    playerRef.current?.pause();
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  async function mix() {
    const inst = instRef.current;
    const vocal = vocalRef.current;
    if (!inst || !vocal || phase === "mixing") return;
    setError("");
    setNotice("");
    setPhase("mixing");
    try {
      let voice = vocal;
      if (cleanVoice) {
        try {
          const fd = new FormData();
          fd.append("audio", vocal, "vocal.webm");
          const res = await fetch("/api/isolate", {
            method: "POST",
            headers: await authHeaders(),
            body: fd,
          });
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error ?? "تعذّرت التنقية");
          }
          voice = await res.blob();
        } catch (e) {
          // التنقية كمالية — فشلها لا يوقف المزج
          setNotice(
            `تعذّرت تنقية الصوت (${e instanceof Error ? e.message : "خطأ"}) — مُزج تسجيلك كما هو.`
          );
        }
      }
      const { mixSongWithVocal } = await import("@/lib/stems");
      const result = await mixSongWithVocal(inst.blob, voice, {
        vocalGain: gainPct / 100,
        vocalOffsetSec: -advanceMs / 1000,
      });
      setLimited(result.limited);
      setMixUrl(keepUrl(result.blob));
      setPhase("mixed");
    } catch {
      setPhase("recorded");
      setError("تعذّر المزج في هذا المتصفح — نزّل تسجيلك وامزجه في برنامج خارجي");
    }
  }

  function reRecord() {
    setVocalUrl("");
    setMixUrl("");
    setError("");
    setNotice("");
    vocalRef.current = null;
    setPhase("idle");
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const showControls = phase === "recorded" || phase === "mixing" || phase === "mixed";

  return (
    <div className="rounded-2xl border border-gold/40 bg-surface-card p-4">
      <p className="text-sm font-semibold">🎙️ غنِّ بصوتك على اللحن</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        {isInstrumental
          ? "يُعزف اللحن في أذنيك ويُسجَّل صوتك معه، ثم يُمزجان في متصفحك مباشرة."
          : "نستخلص النسخة الآلية من أغنيتك، تغني عليها بصوتك، ثم يُمزجان في متصفحك مباشرة."}{" "}
        🎧 استخدم سماعات رأس كي لا يتسرب اللحن إلى الميكروفون.
      </p>

      {phase === "idle" || phase === "preparing" ? (
        <button
          onClick={start}
          disabled={phase === "preparing"}
          className="mt-3 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
        >
          {phase === "preparing" ? "جارٍ تجهيز اللحن..." : "🎙️ ابدأ الغناء على اللحن"}
        </button>
      ) : null}

      {phase === "recording" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={stop}
            className="flex items-center gap-2 rounded-xl bg-primary-strong px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
            أنهِ التسجيل ({mm}:{ss})
          </button>
          <span className="text-xs text-muted">اللحن يُعزف الآن — غنِّ! يتوقف التسجيل بنهايته تلقائياً.</span>
        </div>
      )}

      {showControls && (
        <div className="mt-3 flex flex-col gap-3">
          {vocalUrl && phase !== "mixed" && (
            <audio controls src={vocalUrl} className="w-full" preload="auto" />
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
            <label className="flex items-center gap-2">
              <span className="text-muted">علو صوتك</span>
              <input
                type="range"
                min={50}
                max={300}
                step={10}
                value={gainPct}
                onChange={(e) => setGainPct(Number(e.target.value))}
                className="w-32 accent-[var(--primary)]"
              />
              <span className="w-10 tabular-nums font-semibold">{gainPct}٪</span>
            </label>
            <label
              className="flex items-center gap-2"
              title="قيست تلقائياً لحظة بدء التسجيل — عدّلها فقط إن سمعت انزياحاً بعد المزج"
            >
              <span className="text-muted">تقديم التزامن (مُعاير تلقائياً)</span>
              <input
                type="range"
                min={0}
                max={400}
                step={20}
                value={advanceMs}
                onChange={(e) => setAdvanceMs(Number(e.target.value))}
                className="w-32 accent-[var(--primary)]"
              />
              <span className="w-14 tabular-nums font-semibold">{advanceMs} م‌ث</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={cleanVoice}
                onChange={(e) => setCleanVoice(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              <span>✨ نقِّ صوتي قبل المزج (عزل استوديو)</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={mix}
              disabled={phase === "mixing"}
              className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {phase === "mixing"
                ? "جارٍ المزج..."
                : phase === "mixed"
                  ? "🎚️ أعد المزج بالإعدادات الجديدة"
                  : "🎚️ امزج بصوتي"}
            </button>
            <button
              onClick={reRecord}
              disabled={phase === "mixing"}
              className="rounded-xl border border-border-soft px-4 py-2.5 text-sm text-muted transition-colors hover:text-body disabled:opacity-50"
            >
              🔁 أعد التسجيل
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p className="mt-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-2.5 text-xs">{notice}</p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-2.5 text-xs text-primary-strong">
          {error}
        </p>
      )}

      {phase === "mixed" && mixUrl && (
        <div className="mt-3">
          <AudioPlayer
            src={mixUrl}
            title={`«${song.title}» — بصوتك`}
            filename="maqam-singalong.wav"
            note={limited ? "خُفّض المزيج قليلاً بأكمله لحماية الذروة من التشبع." : undefined}
          >
            <SaveToLibrary
              url={mixUrl}
              kind="song"
              title={`${song.title} — بصوتي`}
              maqamId={maqamId}
              styleId={styleId}
              provider="sing-along"
              settings={{ vocalGainPct: gainPct, advanceMs, cleanVoice }}
            />
          </AudioPlayer>
        </div>
      )}
    </div>
  );
}
