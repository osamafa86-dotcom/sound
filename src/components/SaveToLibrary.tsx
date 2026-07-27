"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { emitSignal } from "@/lib/signalClient";

type Props = {
  /** رابط blob الناتج من التوليد */
  url: string;
  kind: "tts" | "song" | "recording";
  title?: string;
  content?: string;
  voiceId?: string;
  maqamId?: string;
  styleId?: string;
  provider?: string;
  settings?: Record<string, unknown>;
  /** يُستدعى بعد نجاح الحفظ — لإشارات تعلم إضافية لدى الصفحة الأم */
  onSaved?: () => void;
};

export default function SaveToLibrary(props: Props) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const supabase = createClient();
      const user = supabase ? (await supabase.auth.getUser()).data.user : await Promise.resolve(null);
      if (!cancelled) setSignedIn(!!user);
    }
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  // إعادة الضبط عند وصول ناتج جديد (نمط التعديل أثناء التصيير)
  const [lastUrl, setLastUrl] = useState(props.url);
  if (props.url !== lastUrl) {
    setLastUrl(props.url);
    setState("idle");
    setError("");
  }

  async function save() {
    setError("");
    setState("saving");
    try {
      const blob = await (await fetch(props.url)).blob();
      const ext = blob.type === "audio/wav" ? "wav" : "mp3";

      const fd = new FormData();
      fd.append("file", new File([blob], `maqam.${ext}`, { type: blob.type }));
      fd.append("kind", props.kind);
      if (props.title) fd.append("title", props.title);
      if (props.content) fd.append("content", props.content);
      if (props.voiceId) fd.append("voiceId", props.voiceId);
      if (props.maqamId) fd.append("maqamId", props.maqamId);
      if (props.styleId) fd.append("styleId", props.styleId);
      if (props.provider) fd.append("provider", props.provider);
      if (props.settings) fd.append("settings", JSON.stringify(props.settings));

      const res = await fetch("/api/generations", { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر الحفظ");

      setState("saved");
      // الحفظ أقوى إشارات الرضا الضمنية — يغذي ترتيب الأصوات والإعدادات المتعلمة
      emitSignal({
        kind: "saved",
        voiceId: props.voiceId,
        maqamId: props.maqamId,
        settings: props.settings,
      });
      props.onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ");
      setState("idle");
    }
  }

  if (signedIn === null) return null;

  if (!signedIn) {
    return (
      <p className="mt-3 text-xs text-muted">
        <Link href="/login?mode=signup" className="font-semibold text-primary hover:underline">
          أنشئ حساباً مجانياً
        </Link>{" "}
        لحفظ أعمالك في مكتبتك والوصول إليها من أي جهاز.
      </p>
    );
  }

  if (state === "saved") {
    return (
      <p className="mt-3 text-xs text-accent">
        ✓ حُفظ في مكتبتك —{" "}
        <Link href="/library" className="font-semibold hover:underline">
          افتح المكتبة
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-3">
      <button
        onClick={save}
        disabled={state === "saving"}
        className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
      >
        {state === "saving" ? "جارٍ الحفظ..." : "💾 احفظ في مكتبتي"}
      </button>
      {error && <p className="mt-2 text-xs text-primary-strong">{error}</p>}
    </div>
  );
}
