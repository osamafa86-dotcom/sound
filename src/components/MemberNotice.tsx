"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * لافتة الاستوديوهات للزائر غير المسجل — التصفح حر، والتوليد للأعضاء:
 * تظهر مرة واحدة أعلى الاستوديو بدل مفاجأة المستخدم برسالة خطأ عند الضغط.
 */
export default function MemberNotice() {
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return; // بيئة تطوير بلا حسابات — لا لافتة
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && !data.user) setSignedOut(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // نسخة خاصة بلا حسابات — لا داعي لأي دعوة تسجيل
  return null;
  if (!signedOut) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-5 py-4">
      <p className="text-sm leading-relaxed">
        <span className="font-bold">👋 أهلاً بك!</span> تصفّح واستمع للعينات والمعارض بحرية —
        وعندما تجهز للتوليد، <span className="font-semibold">أنشئ حسابك المجاني خلال دقيقة</span>{" "}
        واحصل على رصيد يتجدد كل شهر.
      </p>
      <div className="flex shrink-0 gap-2">
        <Link
          href="/login?mode=signup"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
        >
          أنشئ حساباً مجانياً
        </Link>
        <Link
          href="/login"
          className="rounded-xl border border-border-soft bg-surface px-4 py-2 text-sm font-semibold transition-colors hover:border-primary"
        >
          دخول
        </Link>
      </div>
    </div>
  );
}
