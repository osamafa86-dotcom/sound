"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authHeaders } from "@/lib/supabase";

const TOPICS = ["مشكلة تقنية", "ترقية الباقة", "اقتراح ميزة", "استفسار آخر"];

export default function SupportPage() {
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // بريد المسجل يُملأ تلقائياً — تذكرة أسرع وربط بالحساب
  useEffect(() => {
    const supabase = createClient();
    supabase?.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail((prev) => prev || data.user!.email!);
    });
  }, []);

  async function submit() {
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authHeaders()) },
        body: JSON.stringify({ email, topic, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر الإرسال");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <span className="text-5xl">💌</span>
        <h1 className="mt-4 text-2xl font-bold">وصلت تذكرتك!</h1>
        <p className="mx-auto mt-2 max-w-md leading-relaxed text-muted">
          سنقرؤها ونرد عليك على بريدك <span className="font-semibold text-body">{email}</span> في
          أقرب وقت. شكراً لأنك تساعدنا نحسّن مقام.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold">
        الدعم و<span className="text-gradient">التواصل</span>
      </h1>
      <p className="mt-2 leading-relaxed text-muted">
        مشكلة تقنية؟ تريد ترقية باقتك؟ عندك فكرة تطوّر المنصة؟ اكتب لنا وسنرد على بريدك.
      </p>

      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface-card p-6">
        <div>
          <label className="mb-2 block text-sm font-semibold">بريدك الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={200}
            placeholder="you@example.com"
            dir="ltr"
            className="w-full rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">موضوع التذكرة</label>
          <div className="flex flex-wrap gap-2">
            {TOPICS.map((t) => (
              <button
                key={t}
                onClick={() => setTopic(t)}
                className={`rounded-xl border px-3.5 py-2 text-sm transition-colors ${
                  topic === t
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border-soft text-muted hover:text-body"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold">رسالتك</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
            rows={6}
            placeholder="اشرح طلبك بالتفصيل... وإن كانت مشكلة تقنية اذكر الخطوات التي أدت إليها."
            className="w-full resize-y rounded-xl border border-border-soft bg-surface px-3 py-2.5 text-sm leading-relaxed outline-none transition-colors focus:border-primary"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          onClick={submit}
          disabled={sending || !email.trim() || message.trim().length < 10}
          className="self-start rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "جارٍ الإرسال..." : "📨 أرسل التذكرة"}
        </button>
      </div>
    </div>
  );
}
