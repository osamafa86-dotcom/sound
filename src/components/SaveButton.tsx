"use client";

import { useState } from "react";
import Link from "next/link";
import { saveToLibrary } from "@/lib/library";
import { authHeaders } from "@/lib/supabase";

/** زر «حفظ في مكتبتي» — سحابياً للمسجلين، ومحلياً في المتصفح لغيرهم */
export default function SaveButton({
  blob,
  kind,
  title,
  details,
  jobId,
}: {
  blob: Blob;
  kind: "tts" | "song" | "recording";
  title: string;
  details: string;
  /** عند توفره: يُحفظ خادمياً مباشرة من مخزن المهام دون رفع من المتصفح */
  jobId?: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "cloud" | "local" | "error">("idle");
  const [message, setMessage] = useState("");

  async function save() {
    setState("saving");
    setMessage("");
    try {
      // المسار الخادمي المباشر لمهام الأغاني (لا يمر الصوت عبر المتصفح)
      if (jobId) {
        const headers = await authHeaders();
        if (headers.Authorization) {
          const res = await fetch(`/api/songs/${jobId}/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ title, details }),
          });
          if (res.ok) {
            setState("cloud");
            return;
          }
          // 503 = الحفظ السحابي غير مفعّل، 404 = انتهت صلاحية المهمة → نكمل بالمسار العميل
          if (res.status !== 503 && res.status !== 404) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error ?? "تعذّر الحفظ");
          }
        }
      }
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
