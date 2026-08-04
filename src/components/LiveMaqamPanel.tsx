"use client";

import { useEffect, useRef, useState } from "react";
import {
  LIVE_BPM_MAX,
  LIVE_BPM_MIN,
  buildMusicConfig,
  buildWeightedPrompts,
  clampBpm,
  pcm16ChunkToStereo,
  type WeightedPrompt,
} from "@/lib/liveMaqam";
import { authHeaders } from "@/lib/supabase";

/** الواجهة الدنيا لجلسة Lyria RealTime في @google/genai — بلا any */
type LiveMusicSession = {
  setWeightedPrompts: (args: { weightedPrompts: WeightedPrompt[] }) => Promise<void>;
  setMusicGenerationConfig: (args: {
    musicGenerationConfig: Record<string, number>;
  }) => Promise<void>;
  play: () => void;
  pause?: () => void;
  stop: () => void;
  close?: () => void;
  resetContext?: () => void;
};

type LiveMessage = { serverContent?: { audioChunks?: { data?: string }[] } };

type Phase = "idle" | "connecting" | "playing" | "ended";

/**
 * 🎛️ معاينة المقام الحية — Lyria RealTime يبث الموسيقى لحظياً والمستخدم
 * يقودها وهو يسمع: بدّل المقام من البطاقات فينتقل اللحن، حرّك الإيقاع
 * والحيوية فتتبدل الموسيقى — تجربة تعليمية لا يقدمها منافس عربي.
 */
export default function LiveMaqamPanel({
  maqam,
  signedIn,
}: {
  maqam: { id: string; name: string; stylePrompt: string };
  signedIn: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [bpm, setBpm] = useState(90);
  const [intensity, setIntensity] = useState(0.5);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const sessionRef = useRef<LiveMusicSession | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nextTimeRef = useRef(0);
  const capTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  useEffect(() => stop, []); // تنظيف كامل عند مغادرة الصفحة
  // تبديل المقام من البطاقات أثناء العزف = انتقال حي
  useEffect(() => {
    if (phaseRef.current === "playing") {
      sessionRef.current
        ?.setWeightedPrompts({ weightedPrompts: buildWeightedPrompts(maqam, { bpm, intensity }) })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- الانتقال عند تغيّر المقام فقط
  }, [maqam.id]);

  function scheduleChunk(base64: string) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const raw = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { left, right } = pcm16ChunkToStereo(raw);
    if (!left.length) return;
    const buffer = ctx.createBuffer(2, left.length, 48000);
    buffer.copyToChannel(left, 0);
    buffer.copyToChannel(right, 1);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime + 0.1, nextTimeRef.current);
    source.start(startAt);
    nextTimeRef.current = startAt + buffer.duration;
  }

  async function start() {
    if (phase === "connecting" || phase === "playing") return;
    setError("");
    setPhase("connecting");
    try {
      const res = await fetch("/api/live/token", {
        method: "POST",
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر فتح الجلسة");

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: data.token as string,
        httpOptions: { apiVersion: "v1alpha" },
      });

      const ctx = new AudioContext({ sampleRate: 48000 });
      ctxRef.current = ctx;
      nextTimeRef.current = 0;

      const live = (ai as unknown as {
        live: {
          music: {
            connect: (args: {
              model: string;
              callbacks: {
                onmessage: (m: LiveMessage) => void;
                onerror?: (e: unknown) => void;
                onclose?: () => void;
              };
            }) => Promise<LiveMusicSession>;
          };
        };
      }).live;

      const session = await live.music.connect({
        model: data.model as string,
        callbacks: {
          onmessage: (m) => {
            for (const chunk of m.serverContent?.audioChunks ?? []) {
              if (chunk.data) scheduleChunk(chunk.data);
            }
          },
          onerror: () => {
            if (phaseRef.current === "playing") {
              setError("انقطعت الجلسة الحية — ابدأ من جديد");
              stop();
            }
          },
          onclose: () => {
            if (phaseRef.current === "playing") stop();
          },
        },
      });
      sessionRef.current = session;

      await session.setWeightedPrompts({
        weightedPrompts: buildWeightedPrompts(maqam, { bpm, intensity }),
      });
      await session.setMusicGenerationConfig({
        musicGenerationConfig: buildMusicConfig({ bpm, intensity }),
      });
      session.play();
      setPhase("playing");

      // سقف الجلسة: عدّاد تنازلي ظاهر ثم إيقاف تلقائي
      let left = Number(data.capSec) || 60;
      setSecondsLeft(left);
      capTimerRef.current = setInterval(() => {
        left -= 1;
        setSecondsLeft(left);
        if (left <= 0) stop();
      }, 1000);
    } catch (e) {
      stop();
      setError(e instanceof Error ? e.message : "تعذّر بدء المعاينة الحية");
      setPhase("idle");
    }
  }

  function stop() {
    if (capTimerRef.current) {
      clearInterval(capTimerRef.current);
      capTimerRef.current = null;
    }
    try {
      sessionRef.current?.stop();
      sessionRef.current?.close?.();
    } catch {
      // الجلسة انقطعت أصلاً
    }
    sessionRef.current = null;
    ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
    if (phaseRef.current === "playing" || phaseRef.current === "connecting") setPhase("ended");
  }

  async function applyIntensity(v: number) {
    setIntensity(v);
    if (phaseRef.current !== "playing") return;
    await sessionRef.current
      ?.setWeightedPrompts({ weightedPrompts: buildWeightedPrompts(maqam, { bpm, intensity: v }) })
      .catch(() => {});
    await sessionRef.current
      ?.setMusicGenerationConfig({ musicGenerationConfig: buildMusicConfig({ bpm, intensity: v }) })
      .catch(() => {});
  }

  async function applyBpm(v: number) {
    const clamped = clampBpm(v);
    setBpm(clamped);
    if (phaseRef.current !== "playing") return;
    await sessionRef.current
      ?.setMusicGenerationConfig({
        musicGenerationConfig: buildMusicConfig({ bpm: clamped, intensity }),
      })
      .catch(() => {});
    // تغيير الإيقاع يحتاج إعادة سياق لدى المحرك ليسري فعلياً
    try {
      sessionRef.current?.resetContext?.();
    } catch {
      // الإصدارات التي لا تدعمها تكتفي بالتحول التدريجي
    }
  }

  return (
    <div className="mb-4 rounded-2xl border border-accent/40 bg-accent/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">
            🎛️ معاينة المقام الحية{" "}
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
              تجريبي
            </span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            موسيقى تُولَّد وتُبث لحظياً بمقام {maqam.name} — بدّل المقام من البطاقات أو حرّك
            الإيقاع والحيوية <span className="font-semibold">وأنت تسمع التحول</span>.
          </p>
        </div>
        {phase === "playing" ? (
          <button
            onClick={stop}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-primary-strong px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
            إيقاف ({secondsLeft}ث)
          </button>
        ) : (
          <button
            onClick={start}
            disabled={phase === "connecting"}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {phase === "connecting"
              ? "جارٍ الاتصال..."
              : phase === "ended"
                ? "🎛️ جلسة جديدة"
                : "🎛️ ابدأ المعاينة الحية"}
          </button>
        )}
      </div>

      {phase === "playing" && (
        <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-muted">الإيقاع</span>
            <input
              type="range"
              min={LIVE_BPM_MIN}
              max={LIVE_BPM_MAX}
              step={5}
              value={bpm}
              onChange={(e) => applyBpm(Number(e.target.value))}
              aria-label="سرعة الإيقاع للمعاينة الحية"
              className="w-32 accent-[var(--primary)]"
            />
            <span className="w-8 font-semibold tabular-nums">{bpm}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-muted">الحيوية</span>
            <input
              type="range"
              min={0}
              max={100}
              step={10}
              value={Math.round(intensity * 100)}
              onChange={(e) => applyIntensity(Number(e.target.value) / 100)}
              aria-label="حيوية العزف للمعاينة الحية"
              className="w-32 accent-[var(--primary)]"
            />
            <span className="w-10 font-semibold tabular-nums">
              {Math.round(intensity * 100)}٪
            </span>
          </label>
          {!signedIn && (
            <span className="text-muted">سجّل دخولك لجلسات أطول (150 ثانية)</span>
          )}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-xl border border-primary/40 bg-rose px-4 py-2.5 text-xs text-primary-strong">
          {error}
        </p>
      )}
    </div>
  );
}
