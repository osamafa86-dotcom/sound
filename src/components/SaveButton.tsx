"use client";

import { useState } from "react";
import Link from "next/link";
import { saveToLibrary } from "@/lib/library";

/** زر «حفظ في مكتبتي» — سحابياً للمسجلين، ومحلياً في المتصفح لغيرهم */
export default function SaveButton({
  blob,
  kind,
  title,
  details,
}: {
  blob: Blob;
  kind: "tts" | "song";
  title: string;
  details: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "cloud" | "local" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save() {
    setState("saving");
    setMessage("");
    try {
      const { source } = await saveToLibrary({
        kind,
        title,
        details,
        blob,
        mimeType: blob.type || "audio/mpeg",
      });
      setState(source);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "تعذّر الحفظ");
      setState("error");
    }
  }

  if (state === "cloud" || state === "local") {
    return (
      <p className="text-sm text-gold">
        ✓ حُفظ في {state === "cloud" ? "مكتبتك السحابية" : "المكتبة المحلية بهذا المتصفح"} —{" "}
        <Link href="/library" className="underline">
          افتح مكتبتي
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={save}
        disabled={state === "saving"}
        className="rounded-xl border border-gold px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
      >
        {state === "saving" ? "جارٍ الحفظ..." : "💾 حفظ في مكتبتي"}
      </button>
      {state === "error" && <span className="text-sm text-red-300">{message}</span>}
    </div>
  );
}
