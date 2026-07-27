"use client";

import { useEffect, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import Recorder from "@/components/Recorder";
import WaveLine from "@/components/WaveLine";
import SaveToLibrary from "@/components/SaveToLibrary";
import { VOICES, type Voice } from "@/lib/voices";
import { authHeaders } from "@/lib/supabase";

type Tab = "stt" | "sts" | "clone";

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: "stt", label: "📝 تفريغ نصي", desc: "حوّل تسجيلك إلى نص عربي مكتوب" },
  { id: "sts", label: "🎭 تحويل الصوت", desc: "أداؤك ونبرتك وتوقيتك — بصوت آخر" },
  { id: "clone", label: "🧬 استنساخ صوتي", desc: "نسختك الرقمية تقرأ أي نص بصوتك" },
];

export default function VoiceLab() {
  const [audio, setAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [tab, setTab] = useState<Tab>("stt");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [transcript, setTranscript] = useState("");
  const [copied, setCopied] = useState(false);

  const [voices, setVoices] = useState<Voice[]>(VOICES.filter((v) => v.provider === "elevenlabs"));
  const [targetVoiceId, setTargetVoiceId] = useState<string>("");
  const [converted, setConverted] = useState<{ url: string; blob: Blob; mock: boolean } | null>(null);

  const [cloneName, setCloneName] = useState("");
  const [consent, setConsent] = useState(false);
  const [cloneDone, setCloneDone] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadVoices() {
      try {
        const [catalogRes, customRes] = await Promise.all([
          fetch("/api/voices/catalog"),
          fetch("/api/voices", { headers: await authHeaders() }),
        ]);
        const catalog = await catalogRes.json().catch(() => null);
        const custom = await customRes.json().catch(() => null);
        if (cancelled) return;
        const customVoices: Voice[] = (custom?.voices ?? []).map(
          (v: { id: string; name: string }) => ({
            id: `clone-${v.id}`,
            name: v.name,
            gender: "male" as const,
            dialect: "مستنسخ",
            provider: "elevenlabs" as const,
            tone: "نسختك الرقمية",
            elevenVoiceId: v.id,
          })
        );
        const all = [...customVoices, ...(catalog?.voices ?? [])].filter(
          (v: Voice) => v.elevenVoiceId
        );
        if (all.length) {
          setVoices(all);
          setTargetVoiceId((prev) => prev || all[0].id);
        }
      } catch {
        /* الكتالوج الثابت يبقى بديلاً */
      }
    }
    loadVoices();
    return () => {
      cancelled = true;
    };
  }, [cloneDone]);

  async function transcribe() {
    if (!audio) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("audio", audio, "recording.webm");
      const res = await fetch("/api/stt", { method: "POST", headers: await authHeaders(), body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التفريغ");
      setTranscript(data.text ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  }

  async function convert() {
    if (!audio || !targetVoiceId) return;
    setBusy(true);
    setError("");
    setConverted(null);
    try {
      const form = new FormData();
      form.append("audio", audio, "recording.webm");
      form.append("voiceId", targetVoiceId);
      const res = await fetch("/api/sts", { method: "POST", headers: await authHeaders(), body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر التحويل");
      }
      const blob = await res.blob();
      setConverted({
        url: URL.createObjectURL(blob),
        blob,
        mock: res.headers.get("X-Mock") === "1",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  }

  async function clone() {
    if (!audio || !consent || !cloneName.trim()) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", cloneName.trim());
      form.append("consent", "true");
      form.append("samples", audio, "sample-1.webm");
      const res = await fetch("/api/voices/clone", {
        method: "POST",
        headers: await authHeaders(),
        body: form,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر الاستنساخ");
      setCloneDone(data.name ?? cloneName.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-extrabold md:text-4xl">
        معمل <span className="text-gradient">الصوت</span>
      </h1>
      <WaveLine className="mt-3" />
      <p className="mt-2 text-muted">
        سجّل صوتك أو ارفع تسجيلاً — ثم فرّغه نصياً، أو حوّله لصوت آخر، أو استنسخ نسختك الرقمية.
      </p>

      {/* التسجيل */}
      <div className="mt-8 rounded-2xl border border-border-soft bg-surface-card p-6">
        <h2 className="mb-4 text-lg font-bold">١ — التسجيل</h2>
        <Recorder
          onAudio={(blob) => {
            setAudio(blob);
            setAudioUrl((prev) => {
              if (prev) URL.revokeObjectURL(prev);
              return URL.createObjectURL(blob);
            });
          }}
        />
        {audio && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted">
            <span>✓ التسجيل جاهز ({Math.round(audio.size / 1024)} كيلوبايت)</span>
            {audioUrl && <SaveToLibrary url={audioUrl} kind="recording" title="تسجيل صوتي" />}
          </div>
        )}
      </div>

      {/* الأدوات */}
      <div className="mt-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border-soft text-muted hover:text-body"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">{TABS.find((t) => t.id === tab)?.desc}</p>

        <div className="mt-4 rounded-2xl border border-border-soft bg-surface-card p-6">
          {error && (
            <p className="mb-4 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
              {error}
            </p>
          )}

          {tab === "stt" && (
            <div className="flex flex-col gap-4">
              <button
                onClick={transcribe}
                disabled={!audio || busy}
                className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "جارٍ التفريغ..." : "📝 فرّغ التسجيل نصياً"}
              </button>
              {transcript && (
                <div>
                  <textarea
                    readOnly
                    value={transcript}
                    className="min-h-40 w-full resize-y rounded-xl border border-border-soft bg-surface p-4 leading-loose outline-none"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(transcript);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="mt-2 rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:text-body"
                  >
                    {copied ? "✓ نُسخ" : "📋 نسخ النص"}
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "sts" && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-2 block text-sm font-semibold">الصوت الهدف</label>
                <select
                  value={targetVoiceId}
                  onChange={(e) => setTargetVoiceId(e.target.value)}
                  className="w-full rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none sm:max-w-sm"
                >
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} — {v.dialect}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={convert}
                disabled={!audio || busy}
                className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "جارٍ التحويل..." : "🎭 حوّل الصوت"}
              </button>
              {converted && (
                <div className="flex flex-col gap-3">
                  <AudioPlayer
                    src={converted.url}
                    title="الأداء بالصوت الجديد"
                    mock={converted.mock}
                    filename="maqam-voice-change.mp3"
                  />
                  <SaveToLibrary
                    url={converted.url}
                    kind="tts"
                    title={`تحويل صوت — ${voices.find((v) => v.id === targetVoiceId)?.name ?? ""}`}
                    voiceId={targetVoiceId}
                    provider={converted.mock ? "mock" : "elevenlabs-sts"}
                  />
                </div>
              )}
            </div>
          )}

          {tab === "clone" && (
            <div className="flex flex-col gap-4">
              {cloneDone ? (
                <div className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
                  <p className="font-semibold text-success">✓ اكتمل الاستنساخ: «{cloneDone}»</p>
                  <p className="mt-1 text-muted">
                    صوتك الجديد ظهر الآن في قائمة الأصوات — جرّبه في استوديو النص إلى صوت أو في تحويل الصوت.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-muted">
                    سجّل <span className="font-semibold text-body">دقيقة واحدة على الأقل</span> من الكلام الطبيعي
                    المتصل بجودة نقية (بلا ضجيج)، وسمِّ صوتك، ثم أقرّ بالموافقة.
                  </p>
                  <input
                    value={cloneName}
                    onChange={(e) => setCloneName(e.target.value)}
                    maxLength={60}
                    placeholder="اسم الصوت... مثال: صوتي الإعلاني"
                    className="w-full rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary sm:max-w-sm"
                  />
                  <label className="flex items-start gap-2.5 text-sm leading-relaxed">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      أقرّ أن هذا التسجيل <span className="font-semibold">بصوتي أنا</span>، أو أن لديّ إذناً
                      موثقاً من صاحب الصوت باستنساخه، وأتحمل مسؤولية أي استخدام مخالف.
                    </span>
                  </label>
                  <button
                    onClick={clone}
                    disabled={!audio || !consent || !cloneName.trim() || busy}
                    className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "جارٍ الاستنساخ..." : "🧬 استنسخ صوتي"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
