"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/supabase";

/**
 * أزرار الشراء الحية — تقرأ حالة بوابات الدفع من الخادم:
 * المفعّل يظهر زره الحقيقي، وغير المفعّل يعود بلطف لتذاكر الدعم.
 */

type PayStatus = {
  stripe: boolean;
  crypto: boolean;
  plans: { id: string; usd: number; monthlyCredits: number }[];
  packs: { id: string; name: string; credits: number; usd: number }[];
};

async function startCheckout(
  type: "plan" | "pack",
  id: string,
  provider: "stripe" | "coinbase",
  setBusy: (v: string) => void,
  setError: (v: string) => void
) {
  setError("");
  setBusy(`${id}:${provider}`);
  try {
    const res = await fetch("/api/pay/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ type, id, provider }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? "تعذّر بدء الدفع");
    window.location.href = data.url;
  } catch (e) {
    setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    setBusy("");
  }
}

/** زر اشتراك باقة — يظهر مكان «قريباً» عندما يكون Stripe مفعّلاً */
export function PlanCheckoutButton({ planId, highlight }: { planId: string; highlight: boolean }) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pay/status")
      .then((r) => r.json())
      .then((d: PayStatus) => setEnabled(!!d.stripe))
      .catch(() => setEnabled(false));
  }, []);

  const base = `mt-8 block w-full rounded-xl py-3 text-center font-semibold transition-colors ${
    highlight
      ? "bg-primary text-white hover:bg-primary-strong"
      : "border border-border-soft hover:border-primary"
  }`;

  if (enabled === null) {
    return <span className={`${base} opacity-50`}>...</span>;
  }
  if (!enabled) {
    return (
      <Link href="/support" className={base}>
        اطلب ترقية مبكرة
      </Link>
    );
  }
  return (
    <div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      <button
        onClick={() => startCheckout("plan", planId, "stripe", setBusy, setError)}
        disabled={!!busy}
        className={`${base} disabled:opacity-60`}
      >
        {busy ? "جارٍ التحويل..." : "🚀 اشترك الآن — بطاقة أو Apple Pay"}
      </button>
    </div>
  );
}

/** حزم النقاط — شراء لمرة واحدة بالبطاقة أو العملات الرقمية */
export function CreditPacksSection() {
  const [status, setStatus] = useState<PayStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pay/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status || (!status.stripe && !status.crypto)) return null;

  return (
    <div className="mx-auto mt-14 max-w-3xl">
      <h2 className="text-center text-xl font-bold">حزم نقاط فورية — بلا اشتراك</h2>
      <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-relaxed text-muted">
        تُضاف فوق رصيدك الحالي فور تأكيد الدفع، ولا تنتهي صلاحيتها مع نهاية الشهر.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-center text-sm text-primary-strong">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {status.packs.map((p) => (
          <div key={p.id} className="rounded-2xl border border-border-soft bg-surface-card p-5 text-center">
            <p className="font-bold">{p.name}</p>
            <p className="mt-2 text-3xl font-bold text-gold">⚡ {p.credits.toLocaleString("en-US")}</p>
            <p className="mt-1 text-sm text-muted">${p.usd}</p>
            <div className="mt-4 flex flex-col gap-2">
              {status.stripe && (
                <button
                  onClick={() => startCheckout("pack", p.id, "stripe", setBusy, setError)}
                  disabled={!!busy}
                  className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-60"
                >
                  {busy === `${p.id}:stripe` ? "..." : "💳 بطاقة / Apple Pay"}
                </button>
              )}
              {status.crypto && (
                <button
                  onClick={() => startCheckout("pack", p.id, "coinbase", setBusy, setError)}
                  disabled={!!busy}
                  className="rounded-lg border border-primary/50 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-rose disabled:opacity-60"
                >
                  {busy === `${p.id}:coinbase` ? "..." : "₿ عملة رقمية"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
