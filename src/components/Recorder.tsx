"use client";

import { useEffect, useRef, useState } from "react";

/** مسجّل صوتي داخل المتصفح (MediaRecorder) مع بديل رفع ملف جاهز */
export default function Recorder({ onAudio }: { onAudio: (blob: Blob) => void }) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function setAudio(blob: Blob) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
    onAudio(blob);
  }

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : undefined;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        setAudio(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("تعذّر الوصول للميكروفون — تأكد من منح الإذن في المتصفح");
    }
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAudio(file);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {recording ? (
          <button
            onClick={stop}
            className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 font-semibold text-white transition-opacity hover:opacity-90"
          >
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
            إيقاف التسجيل ({mm}:{ss})
          </button>
        ) : (
          <button
            onClick={start}
            className="rounded-xl bg-primary px-5 py-2.5 font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            🎙️ ابدأ التسجيل
          </button>
        )}
        <label className="cursor-pointer rounded-xl border border-border-soft px-4 py-2.5 text-sm text-muted transition-colors hover:text-body">
          📁 أو ارفع ملفاً صوتياً
          <input type="file" accept="audio/*" onChange={onFile} className="hidden" />
        </label>
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}

      {previewUrl && !recording && (
        <audio controls src={previewUrl} className="w-full" preload="auto" />
      )}
    </div>
  );
}
