"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function GateForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: "استجابة غير صالحة" }));
      if (!res.ok || !data.ok) {
        setError(data.error || "كلمة السر غير صحيحة");
        setLoading(false);
        return;
      }
      const next = params.get("next") || "/";
      // الانتقال الكامل (لا router.push) حتى يعيد الخادم تقييم البوابة بالكوكي الجديد
      window.location.href = next.startsWith("/") ? next : "/";
    } catch {
      setError("تعذّر الاتصال بالخادم — تحقق من الشبكة وأعد المحاولة");
      setLoading(false);
    }
  }

  return (
    <div className="card-lift w-full rounded-3xl border border-border-soft bg-surface-card p-8">
      <div className="mb-5 flex justify-center">
        <span
          aria-hidden
          className="flex h-13 w-13 items-center justify-center gap-[3.5px] rounded-2xl bg-primary p-3.5 shadow-lg shadow-primary/25"
        >
          {[13, 24, 16, 26].map((h, i) => (
            <span key={i} className="w-[3.5px] rounded-full bg-white" style={{ height: h }} />
          ))}
        </span>
      </div>
      <h1 className="text-center text-2xl font-bold">لحّن</h1>
      <p className="mt-2 text-center text-sm text-muted">
        هذا الموقع خاص حالياً — أدخل كلمة السر للمتابعة
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <input
          type="password"
          required
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة السر"
          dir="ltr"
          className="rounded-xl border border-border-soft bg-surface px-4 py-3 text-center outline-none transition-colors focus:border-primary"
        />

        {error && (
          <p className="rounded-xl border border-primary/40 bg-rose px-4 py-3 text-center text-sm text-primary-strong">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
        >
          {loading ? "جارٍ التحقق..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
