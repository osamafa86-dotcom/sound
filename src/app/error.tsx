"use client";

import { useEffect } from "react";

/** شاشة الخطأ العامة — عربية ومطمئنة بدل شاشة Next الافتراضية الإنجليزية */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-6xl">🎛️</p>
      <h1 className="mt-5 text-3xl font-bold">نشاز غير متوقع</h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
        حدث خطأ أثناء تحميل هذه الصفحة. جرّب مرة أخرى — وإن تكرر، أخبرنا عبر صفحة الدعم.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
        >
          ↻ حاول مجدداً
        </button>
        <a
          href="/support"
          className="rounded-xl border border-border-soft px-6 py-3 font-semibold transition-colors hover:border-primary"
        >
          💌 راسل الدعم
        </a>
      </div>
    </div>
  );
}
