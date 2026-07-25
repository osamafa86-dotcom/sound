"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isLogin = mode === "login";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return;
    setError("");
    setNotice("");
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
        router.push("/library");
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        if (data.session) {
          router.push("/library");
        } else {
          // المشروع يشترط تأكيد البريد قبل الدخول
          setNotice("أُرسل رابط تأكيد إلى بريدك — افتحه لإكمال التسجيل ثم سجّل الدخول.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  if (!supabaseConfigured) {
    return (
      <div className="rounded-2xl border border-dashed border-border-soft bg-surface-card/50 p-8 text-center">
        <span className="text-4xl">🔐</span>
        <h2 className="mt-3 text-lg font-bold">الحسابات غير مفعّلة بعد</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
          لتفعيل الحسابات والمكتبة السحابية: أنشئ مشروع Supabase، نفّذ ملف
          <code dir="ltr" className="mx-1 rounded bg-surface px-1.5 py-0.5 text-xs">supabase/schema.sql</code>
          في محرر SQL، ثم أضف NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY إلى ملف .env.local.
        </p>
        <p className="mt-3 text-xs text-muted">
          يمكنك الاستفادة من المكتبة المحلية في المتصفح دون حساب من الآن.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border-soft bg-surface-card p-6">
      <div>
        <label className="mb-2 block text-sm font-semibold">البريد الإلكتروني</label>
        <input
          type="email"
          required
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold">كلمة المرور</label>
        <input
          type="password"
          required
          minLength={8}
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="8 أحرف على الأقل"
          className="w-full rounded-xl border border-border-soft bg-surface p-3 text-sm outline-none transition-colors focus:border-primary"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      )}
      {notice && (
        <p className="rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">{notice}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
      >
        {loading ? "لحظات..." : isLogin ? "تسجيل الدخول" : "إنشاء الحساب"}
      </button>

      <p className="text-center text-sm text-muted">
        {isLogin ? (
          <>
            ليس لديك حساب؟{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              أنشئ حساباً
            </Link>
          </>
        ) : (
          <>
            لديك حساب بالفعل؟{" "}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              سجّل الدخول
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
