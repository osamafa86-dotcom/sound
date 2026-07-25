"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "login";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || email.split("@")[0] } },
        });
        if (error) throw error;

        // عند تفعيل تأكيد البريد لا تُنشأ جلسة مباشرة
        if (!data.session) {
          setInfo("أرسلنا رابط تأكيد إلى بريدك — افتحه لتفعيل حسابك ثم سجّل الدخول.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }

      router.push("/library");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      setError(
        /invalid login/i.test(msg)
          ? "البريد أو كلمة السر غير صحيحة"
          : /already registered|already exists/i.test(msg)
            ? "هذا البريد مسجّل مسبقاً — سجّل الدخول بدلاً من ذلك"
            : /password/i.test(msg) && /6/.test(msg)
              ? "كلمة السر يجب أن تكون 6 أحرف على الأقل"
              : msg
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-border-soft bg-surface-card p-8">
        <h1 className="text-2xl font-bold">
          {mode === "signup" ? "إنشاء حساب جديد" : "تسجيل الدخول"}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {mode === "signup"
            ? "احفظ أعمالك في مكتبتك الخاصة واحصل على رصيد مجاني للبدء."
            : "أهلاً بعودتك — ادخل لتصل إلى مكتبتك."}
        </p>

        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          {mode === "signup" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              placeholder="الاسم (اختياري)"
              className="rounded-xl border border-border-soft bg-surface px-4 py-3 outline-none transition-colors focus:border-primary"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="البريد الإلكتروني"
            dir="ltr"
            className="rounded-xl border border-border-soft bg-surface px-4 py-3 text-start outline-none transition-colors focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="كلمة السر (6 أحرف فأكثر)"
            dir="ltr"
            className="rounded-xl border border-border-soft bg-surface px-4 py-3 text-start outline-none transition-colors focus:border-primary"
          />

          {error && (
            <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </p>
          )}
          {info && (
            <p className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {loading ? "جارٍ..." : mode === "signup" ? "أنشئ الحساب" : "دخول"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "signup" ? (
            <>
              لديك حساب؟{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                سجّل الدخول
              </Link>
            </>
          ) : (
            <>
              ليس لديك حساب؟{" "}
              <Link href="/login?mode=signup" className="font-semibold text-primary hover:underline">
                أنشئ حساباً
              </Link>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted">جارٍ التحميل...</div>}>
      <LoginForm />
    </Suspense>
  );
}
