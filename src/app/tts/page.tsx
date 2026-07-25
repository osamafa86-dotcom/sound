"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AudioPlayer from "@/components/AudioPlayer";
import { DIALECTS, VOICES } from "@/lib/voices";

type CustomVoice = { id: string; name: string };

export default function TTSStudio() {
  const [text, setText] = useState("");
  const [dialect, setDialect] = useState<string>("الكل");
  const [voiceId, setVoiceId] = useState(VOICES[0].id);

  // الأصوات المستنسخة + نموذج الاستنساخ
  const [customVoices, setCustomVoices] = useState<CustomVoice[]>([]);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneName, setCloneName] = useState("");
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [cloning, setCloning] = useState(false);
  const [cloneError, setCloneError] = useState("");
  const [cloneSuccess, setCloneSuccess] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // تصميم صوت جديد من وصف نصي
  const [designOpen, setDesignOpen] = useState(false);
  const [designDesc, setDesignDesc] = useState("");
  const [designName, setDesignName] = useState("");
  const [designing, setDesigning] = useState(false);
  const [savingDesign, setSavingDesign] = useState("");
  const [designError, setDesignError] = useState("");
  const [previews, setPreviews] = useState<{ generatedVoiceId: string; url: string }[]>([]);

  async function designVoice() {
    setDesignError("");
    setPreviews([]);
    setDesigning(true);
    try {
      const res = await fetch("/api/voices/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: designDesc }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر تصميم الصوت");

      setPreviews(
        (data.previews ?? []).map((p: { generatedVoiceId: string; audio: string; mediaType: string }) => ({
          generatedVoiceId: p.generatedVoiceId,
          url: `data:${p.mediaType};base64,${p.audio}`,
        }))
      );
    } catch (e) {
      setDesignError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setDesigning(false);
    }
  }

  async function saveDesign(generatedVoiceId: string) {
    if (!designName.trim()) {
      setDesignError("اكتب اسماً للصوت قبل الحفظ");
      return;
    }
    setDesignError("");
    setSavingDesign(generatedVoiceId);
    try {
      const res = await fetch("/api/voices/design", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: designName.trim(), description: designDesc, generatedVoiceId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر حفظ الصوت");

      setCustomVoices((prev) => [{ id: data.voiceId, name: data.name }, ...prev]);
      setVoiceId(`custom:${data.voiceId}`);
      setPreviews([]);
      setDesignName("");
      setDesignDesc("");
      setCloneSuccess(`تم حفظ صوت «${data.name}» — اخترناه لك، اكتب نصاً وجرّبه!`);
    } catch (e) {
      setDesignError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setSavingDesign("");
    }
  }

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((d) => setCustomVoices(d.voices ?? []))
      .catch(() => {});
  }, []);

  async function startRecording() {
    setCloneError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setCloneFile(new File([blob], "تسجيل-مباشر.webm", { type: blob.type }));
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setCloneError("تعذر الوصول للمايكروفون — تأكد من السماح للموقع باستخدامه");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function submitClone() {
    if (!cloneName.trim() || !cloneFile || !consent) return;
    setCloneError("");
    setCloneSuccess("");
    setCloning(true);
    try {
      const fd = new FormData();
      fd.append("name", cloneName.trim());
      fd.append("file", cloneFile);
      const res = await fetch("/api/voices", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذر استنساخ الصوت");
      setCustomVoices((prev) => [{ id: data.voiceId, name: data.name }, ...prev]);
      setVoiceId(`custom:${data.voiceId}`);
      setCloneSuccess(`تم إنشاء صوت «${data.name}» — اخترناه لك، اكتب نصاً وجرّبه!`);
      setCloneName("");
      setCloneFile(null);
      setConsent(false);
    } catch (e) {
      setCloneError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setCloning(false);
    }
  }
  const [speed, setSpeed] = useState(1);
  const [stability, setStability] = useState(0.5);
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; mock: boolean; ext: string; fellBack: boolean } | null>(null);
  const [error, setError] = useState("");

  const shownVoices = useMemo(
    () => (dialect === "الكل" ? VOICES : VOICES.filter((v) => v.dialect === dialect)),
    [dialect]
  );

  async function generate() {
    if (!text.trim()) {
      setError("اكتب النص أولاً");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voiceId, speed, stability, format }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر التوليد، حاول مجدداً");
      }
      const mock = res.headers.get("X-Mock") === "1";
      const fellBack = res.headers.has("X-Fallback");
      const blob = await res.blob();
      const ext = blob.type === "audio/mpeg" ? "mp3" : "wav";
      setResult({ url: URL.createObjectURL(blob), mock, ext, fellBack });
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        استوديو <span className="text-gradient">النص إلى صوت</span>
      </h1>
      <p className="mt-2 text-muted">
        اكتب نصك، اختر الصوت واللهجة، واضبط الأداء — ثم استمع وحمّل الناتج.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
        {/* النص */}
        <div className="flex flex-col gap-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={5000}
            placeholder={"اكتب النص هنا...\nمثال: أهلاً بكم في منصة مقام، حيث تتحول الكلمات إلى صوتٍ نابضٍ بالحياة."}
            className="min-h-72 w-full resize-y rounded-2xl border border-border-soft bg-surface-card p-5 leading-relaxed outline-none transition-colors focus:border-primary"
          />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{text.length} / 5000 حرف</span>
            <span>تدعم الفصحى واللهجات</span>
          </div>

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={generate}
            disabled={loading}
            className="rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {loading ? "جارٍ التوليد..." : "🎙️ توليد الصوت"}
          </button>

          {result && (
            <AudioPlayer
              src={result.url}
              title="الناتج الصوتي"
              mock={result.mock}
              filename={`maqam-tts.${result.ext}`}
              note={
                result.fellBack
                  ? "تعذّر الوصول لمحرك ElevenLabs من هذه البيئة، فعُرضت نغمة تجريبية بدلاً منه."
                  : undefined
              }
            />
          )}
        </div>

        {/* الإعدادات */}
        <aside className="flex h-fit flex-col gap-5 rounded-2xl border border-border-soft bg-surface-card p-5">
          {/* استنساخ الصوت */}
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4">
            <button
              onClick={() => setCloneOpen(!cloneOpen)}
              className="flex w-full items-center justify-between text-sm font-bold"
            >
              <span>🎤 صوتك الخاص (استنساخ)</span>
              <span className={`text-muted transition-transform ${cloneOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>

            {cloneOpen && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted">
                  ارفع عينة من صوتك (30 ثانية – 3 دقائق كلام واضح بلا ضجيج) أو سجّلها الآن،
                  وسينطق الموقع أي نص بنفس نبرتك وطبقتك.
                </p>

                <input
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  maxLength={60}
                  placeholder="اسم الصوت... مثال: صوتي"
                  className="rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                />

                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer rounded-lg border border-border-soft px-3 py-2 text-center text-xs text-muted transition-colors hover:border-accent hover:text-body">
                    📁 اختر ملفاً
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        setCloneFile(e.target.files?.[0] ?? null);
                        setCloneError("");
                      }}
                    />
                  </label>
                  <button
                    onClick={recording ? stopRecording : startRecording}
                    className={`flex-1 rounded-lg border px-3 py-2 text-xs transition-colors ${
                      recording
                        ? "animate-pulse border-red-500 bg-red-500/10 text-red-300"
                        : "border-border-soft text-muted hover:border-accent hover:text-body"
                    }`}
                  >
                    {recording ? "⏹ إيقاف التسجيل" : "🔴 سجّل من المايك"}
                  </button>
                </div>

                {cloneFile && (
                  <p className="rounded-lg bg-surface px-3 py-2 text-xs text-accent">
                    ✓ العينة جاهزة: {cloneFile.name} ({(cloneFile.size / 1024 / 1024).toFixed(1)}MB)
                  </p>
                )}

                <label className="flex items-start gap-2 text-xs leading-relaxed text-muted">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5"
                  />
                  أقرّ أن هذا الصوت لي، أو أن لديّ إذناً صريحاً من صاحبه باستنساخه واستخدامه.
                </label>

                {cloneError && (
                  <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {cloneError}
                  </p>
                )}
                {cloneSuccess && (
                  <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                    {cloneSuccess}
                  </p>
                )}

                <button
                  onClick={submitClone}
                  disabled={cloning || !cloneName.trim() || !cloneFile || !consent}
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cloning ? "جارٍ الاستنساخ..." : "🧬 استنسخ الصوت"}
                </button>
              </div>
            )}
          </div>

          {/* تصميم صوت من وصف */}
          <div className="rounded-xl border border-gold/30 bg-gold/5 p-4">
            <button
              onClick={() => setDesignOpen(!designOpen)}
              className="flex w-full items-center justify-between text-sm font-bold"
            >
              <span>🎨 صمّم صوتاً جديداً</span>
              <span className={`text-muted transition-transform ${designOpen ? "rotate-180" : ""}`}>⌄</span>
            </button>

            {designOpen && (
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-muted">
                  صف الصوت الذي تريده بالعربية — العمر، الجنس، اللهجة، النبرة — وسيصنعه الذكاء
                  الاصطناعي من الصفر. مثالي لإنشاء أصوات فلسطينية بتنويعات غير متوفرة في المكتبة.
                </p>

                <textarea
                  value={designDesc}
                  onChange={(e) => setDesignDesc(e.target.value)}
                  maxLength={800}
                  rows={3}
                  placeholder="مثال: امرأة فلسطينية في الثلاثينات من نابلس، صوت دافئ وحنون بلهجة شامية، نبرة هادئة مناسبة لسرد القصص"
                  className="resize-y rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-gold"
                />

                <button
                  onClick={designVoice}
                  disabled={designing || designDesc.trim().length < 20}
                  className="rounded-lg bg-gold px-3 py-2 text-sm font-semibold text-surface transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {designing ? "جارٍ التصميم..." : "🎨 صمّم 3 معاينات"}
                </button>

                {designError && (
                  <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                    {designError}
                  </p>
                )}

                {previews.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <input
                      value={designName}
                      onChange={(e) => setDesignName(e.target.value)}
                      maxLength={60}
                      placeholder="اسم الصوت... مثال: نور الفلسطينية"
                      className="rounded-lg border border-border-soft bg-surface px-3 py-2 text-sm outline-none focus:border-gold"
                    />
                    <p className="text-xs text-muted">استمع للثلاثة واحفظ الأفضل:</p>
                    {previews.map((p, i) => (
                      <div key={p.generatedVoiceId} className="rounded-lg border border-border-soft bg-surface p-3">
                        <p className="mb-2 text-xs font-semibold">المعاينة {i + 1}</p>
                        <audio controls src={p.url} className="w-full" preload="none" />
                        <button
                          onClick={() => saveDesign(p.generatedVoiceId)}
                          disabled={!!savingDesign}
                          className="mt-2 w-full rounded-lg border border-gold px-3 py-1.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"
                        >
                          {savingDesign === p.generatedVoiceId ? "جارٍ الحفظ..." : "✓ احفظ هذا الصوت"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* أصواتي المستنسخة */}
          {customVoices.length > 0 && (
            <div>
              <label className="mb-2 block text-sm font-semibold">أصواتي المستنسخة</label>
              <div className="flex flex-col gap-2">
                {customVoices.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoiceId(`custom:${v.id}`)}
                    className={`rounded-xl border px-3 py-2.5 text-start transition-colors ${
                      voiceId === `custom:${v.id}`
                        ? "border-accent bg-accent/10"
                        : "border-border-soft hover:border-accent/50"
                    }`}
                  >
                    <span className="font-semibold">🧬 {v.name}</span>
                    <span className="mt-1 block text-xs text-muted">صوت مستنسخ — ينطق بنبرة صاحبه</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold">اللهجة</label>
            <select
              value={dialect}
              onChange={(e) => {
                setDialect(e.target.value);
                const first = e.target.value === "الكل" ? VOICES[0] : VOICES.find((v) => v.dialect === e.target.value);
                if (first) setVoiceId(first.id);
              }}
              className="w-full rounded-xl border border-border-soft bg-surface-raised px-3 py-2.5 outline-none focus:border-primary"
            >
              <option>الكل</option>
              {DIALECTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">الصوت</label>
            <div className="flex flex-col gap-2">
              {shownVoices.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVoiceId(v.id)}
                  className={`rounded-xl border px-3 py-2.5 text-start transition-colors ${
                    voiceId === v.id
                      ? "border-primary bg-primary/10"
                      : "border-border-soft hover:border-primary/50"
                  }`}
                >
                  <span className="flex items-center justify-between">
                    <span className="font-semibold">
                      {v.gender === "male" ? "👨" : "👩"} {v.name}
                      <span className="mx-2 rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
                        {v.dialect}
                      </span>
                    </span>
                  </span>
                  <span className="mt-1 block text-xs text-muted">{v.tone}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 flex justify-between text-sm font-semibold">
              <span>السرعة</span>
              <span className="text-muted">{speed.toFixed(2)}×</span>
            </label>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-2 flex justify-between text-sm font-semibold">
              <span>الثبات ↔ التعبير</span>
              <span className="text-muted">{Math.round(stability * 100)}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={stability}
              onChange={(e) => setStability(Number(e.target.value))}
              className="w-full"
            />
            <p className="mt-1 text-xs text-muted">
              ثبات أعلى = أداء متزن؛ ثبات أقل = تعبير عاطفي أقوى
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">صيغة الملف</label>
            <div className="grid grid-cols-2 gap-2">
              {(["mp3", "wav"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`rounded-xl border py-2 text-sm font-semibold uppercase transition-colors ${
                    format === f ? "border-primary bg-primary/10" : "border-border-soft"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
