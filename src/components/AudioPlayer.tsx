"use client";

import { useEffect, useRef, useState } from "react";

/** عدد أعمدة شكل الموجة المرسومة */
const BARS = 160;

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** تفكيك الملف إلى قمم مطبّعة للرسم — أخذ عينة كل ٣٢ إطاراً يكفي بصرياً */
async function extractPeaks(src: string): Promise<number[]> {
  const buf = await (await fetch(src)).arrayBuffer();
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(buf);
    const data = audio.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / BARS));
    const peaks: number[] = [];
    for (let i = 0; i < BARS; i++) {
      let max = 0;
      const end = Math.min((i + 1) * step, data.length);
      for (let j = i * step; j < end; j += 32) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
      }
      peaks.push(max);
    }
    const top = Math.max(...peaks, 0.01);
    return peaks.map((p) => p / top);
  } finally {
    ctx.close();
  }
}

export default function AudioPlayer({
  src,
  title,
  mock,
  filename = "maqam-audio.wav",
  note,
  children,
}: {
  src: string;
  title: string;
  mock?: boolean;
  filename?: string;
  note?: string;
  /** إجراءات إضافية أسفل المشغّل — مثل زر الحفظ في المكتبة */
  children?: React.ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // إعادة الضبط عند وصول ملف جديد (نمط التعديل أثناء التصيير)
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setPeaks(null);
    setFailed(false);
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
    setDuration(0);
  }

  useEffect(() => {
    let cancelled = false;
    extractPeaks(src)
      .then((p) => {
        if (!cancelled) setPeaks(p);
      })
      .catch(() => {
        // تعذّر الفك (صيغة أو CORS) — يبقى مشغّل المتصفح الأصلي
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  // رسم الموجة: المقاطع المسموعة بالذهبي والباقي خافت
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.scale(dpr, dpr);

    const css = getComputedStyle(document.documentElement);
    const played = css.getPropertyValue("--gold").trim() || "#e0b354";
    const rest = css.getPropertyValue("--primary").trim() || "#8b5cf6";

    const w = rect.width;
    const h = rect.height;
    const slot = w / BARS;
    const barW = Math.max(1.5, slot * 0.65);
    const playedBars = progress * BARS;

    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < peaks.length; i++) {
      const barH = Math.max(2, peaks[i] * (h - 6));
      const x = i * slot + (slot - barW) / 2;
      const y = (h - barH) / 2;
      const isPlayed = i < playedBars;
      ctx.globalAlpha = isPlayed ? 1 : 0.35;
      ctx.fillStyle = isPlayed ? played : rest;
      ctx.beginPath();
      ctx.roundRect(x, y, barW, barH, barW / 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [peaks, progress]);

  // تتبع سلس للتقدم أثناء التشغيل
  useEffect(() => {
    if (!playing) return;
    const tick = () => {
      const a = audioRef.current;
      if (a && a.duration) {
        setCurrent(a.currentTime);
        setProgress(a.currentTime / a.duration);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }

  function seek(e: React.MouseEvent<HTMLCanvasElement>) {
    const a = audioRef.current;
    const canvas = canvasRef.current;
    if (!a || !canvas || !a.duration) return;
    const rect = canvas.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = frac * a.duration;
    setCurrent(a.currentTime);
    setProgress(frac);
  }

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        {mock && (
          <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            وضع تجريبي — بانتظار ربط مفاتيح الـ API
          </span>
        )}
      </div>

      <audio
        ref={audioRef}
        src={src}
        controls={failed}
        className={failed ? "w-full" : "hidden"}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(1);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          if (a.duration) {
            setCurrent(a.currentTime);
            setProgress(a.currentTime / a.duration);
          }
        }}
      />

      {!failed && (
        <div dir="ltr" className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label={playing ? "إيقاف مؤقت" : "تشغيل"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-lg text-white transition-colors hover:bg-primary-strong"
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <span className="w-10 shrink-0 text-center text-xs tabular-nums text-muted">
            {formatTime(current)}
          </span>
          <canvas
            ref={canvasRef}
            onClick={seek}
            className={`h-14 min-w-0 flex-1 cursor-pointer ${peaks ? "" : "animate-pulse rounded-lg bg-surface"}`}
          />
          <span className="w-10 shrink-0 text-center text-xs tabular-nums text-muted">
            {formatTime(duration)}
          </span>
        </div>
      )}

      {note && <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>}
      <a
        href={src}
        download={filename}
        className="mt-3 inline-block rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
      >
        ⬇ تنزيل الملف
      </a>
      {children}
    </div>
  );
}
