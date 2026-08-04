"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UNREACHABLE, isNetworkError, withTimeout } from "@/lib/timeout";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const mode = params.get("mode") === "signup" ? "signup" : "login";
  const confirmed = params.get("confirmed") === "1";
  // وصل من رابط استعادة كلمة السر في بريده — جلسة مؤقتة تسمح بتعيين كلمة جديدة
  const recovery = params.get("recovery") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  // أخطاء روابط البريد تصل في جزء الهاش (#error_code=otp_expired...) — نعرضها بلغة مفهومة
  const [linkError, setLinkError] = useState("");
  const [resending, setResending] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = hash.get("error_code");
      if (cancelled || !code) return;
      setLinkError(
        code === "otp_expired"
          ? "رابط التأكيد انتهت صلاحيته أو استُخدم من قبل. اكتب بريدك في الخانة ثم اضغط «أعد إرسال رابط التأكيد»."
          : hash.get("error_description") ?? "تعذّر تأكيد البريد — حاول مجدداً"
      );
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function resendConfirmation() {
    if (!email) {
      setError("اكتب بريدك الإلكتروني في الخانة أولاً ثم اضغط إعادة الإرسال");
      return;
    }
    setResending(true);
    setError("");
    setInfo("");
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("نظام الحسابات غير مفعّل بعد على هذا الموقع");
      const { error } = await withTimeout(
        supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: `${location.origin}/login?confirmed=1` },
        })
      );
      if (error) throw error;
      setLinkError("");
      setInfo("أرسلنا رابط تأكيد جديداً إلى بريدك — افتحه من نفس هذا الجهاز.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إرسال الرابط");
    } finally {
      setResending(false);
    }
  }

  /** إرسال رابط استعادة كلمة السر إلى البريد */
  async function forgotPassword() {
    if (!email) {
      setError("اكتب بريدك الإلكتروني في الخانة أولاً ثم اضغط «نسيت كلمة السر»");
      return;
    }
    setSendingReset(true);
    setError("");
    setInfo("");
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("نظام الحسابات غير مفعّل بعد على هذا الموقع");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/login?recovery=1`,
      });
      if (error) throw error;
      setInfo("أرسلنا رابط استعادة كلمة السر إلى بريدك — افتحه من نفس هذا الجهاز واتبع الخطوات.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر إرسال رابط الاستعادة");
    } finally {
      setSendingReset(false);
    }
  }

  /** تعيين كلمة السر الجديدة — بعد الوصول من رابط الاستعادة بجلسته المؤقتة */
  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("نظام الحسابات غير مفعّل بعد على هذا الموقع");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/library");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      setError(
        /session|auth/i.test(msg)
          ? "انتهت صلاحية رابط الاستعادة — اطلب رابطاً جديداً من «نسيت كلمة السر»"
          : /different from the old/i.test(msg)
            ? "كلمة السر الجديدة مطابقة للقديمة — اختر كلمة مختلفة"
            : msg
      );
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("نظام الحسابات غير مفعّل بعد على هذا الموقع");

      if (mode === "signup") {
        const { data, error } = await withTimeout(
          supabase.auth.signUp({
            email,
            password,
            options: {
              data: { display_name: name || email.split("@")[0] },
              // رابط العودة بعد تأكيد البريد — لموقعنا الفعلي لا لإعدادات المشروع الافتراضية
              emailRedirectTo: `${location.origin}/login?confirmed=1`,
            },
          })
        );
        if (error) throw error;

        // عند تفعيل تأكيد البريد لا تُنشأ جلسة مباشرة
        if (!data.session) {
          setInfo("أرسلنا رابط تأكيد إلى بريدك — افتحه لتفعيل حسابك ثم سجّل الدخول.");
          return;
        }
      } else {
        const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
        if (error) throw error;
      }

      router.push("/library");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "حدث خطأ";
      setError(
        isNetworkError(msg)
          ? UNREACHABLE
          : /invalid login/i.test(msg)
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
      <div className="card-lift rounded-3xl border border-border-soft bg-surface-card p-8">
        <div className="mb-5 flex justify-center">
          <span aria-hidden className="flex h-13 w-13 items-center justify-center gap-[3.5px] rounded-2xl bg-primary p-3.5 shadow-lg shadow-primary/25">
            {[13, 24, 16, 26].map((h, i) => (
              <span key={i} className="w-[3.5px] rounded-full bg-white" style={{ height: h }} />
            ))}
          </span>
        </div>
        <h1 className="text-center text-2xl font-bold">
          {recovery ? "تعيين كلمة سر جديدة" : mode === "signup" ? "إنشاء حساب جديد" : "تسجيل الدخول"}
        </h1>
        <p className="mt-2 text-center text-sm text-muted">
          {recovery
            ? "وصلت من رابط الاستعادة — اختر كلمة سر جديدة وستدخل مباشرة."
            : mode === "signup"
              ? "احفظ أعمالك في مكتبتك الخاصة واحصل على رصيد مجاني للبدء."
              : "أهلاً بعودتك — ادخل لتصل إلى مكتبتك."}
        </p>

        {confirmed && !info && !error && (
          <p className="mt-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-accent">
            ✓ تم تأكيد بريدك بنجاح — سجّل الدخول الآن.
          </p>
        )}
        {linkError && (
          <div className="mt-4 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm">
            <p>{linkError}</p>
            <button
              type="button"
              onClick={resendConfirmation}
              disabled={resending}
              className="mt-2 rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-rose disabled:opacity-50"
            >
              {resending ? "جارٍ الإرسال..." : "📧 أعد إرسال رابط التأكيد"}
            </button>
          </div>
        )}

        {recovery && (
          <form onSubmit={updatePassword} className="mt-6 flex flex-col gap-4">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="كلمة السر الجديدة (6 أحرف فأكثر)"
              dir="ltr"
              autoFocus
              className="rounded-xl border border-border-soft bg-surface px-4 py-3 text-start outline-none transition-colors focus:border-primary"
            />
            {error && (
              <p className="rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
            >
              {loading ? "جارٍ..." : "🔑 عيّن كلمة السر وادخل"}
            </button>
          </form>
        )}

        {!recovery && (
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

          {mode === "login" && (
            <button
              type="button"
              onClick={forgotPassword}
              disabled={sendingReset}
              className="self-start text-xs text-muted underline-offset-2 transition-colors hover:text-primary hover:underline disabled:opacity-50"
            >
              {sendingReset ? "جارٍ إرسال الرابط..." : "نسيت كلمة السر؟"}
            </button>
          )}

          {error && (
            <p className="rounded-xl border border-primary/40 bg-rose px-4 py-3 text-sm text-primary-strong">
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
        )}

        {!recovery && (
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
        )}
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
