"use client";

import { useEffect, useState } from "react";
import type { LimitRuleRow, LimitWindow } from "@/lib/admin/types";
import { Badge, Card, Table, fmtNum, fmtUsd } from "./ui";

type LimitsResponse = {
  rules: LimitRuleRow[];
  configured?: boolean;
  windows?: LimitWindow[];
};

const humanWindow = (sec: number) => (sec >= 86400 ? `${sec / 86400} يوم` : `${sec / 3600} ساعة`);

/** الحدود السارية والنوافذ المستهلكة الآن، مع تصفير فوري لأي مفتاح */
export default function LimitsTab() {
  const [data, setData] = useState<LimitsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  // زيادة الرمز تعيد تشغيل الجلب — الطلب من زر المستخدم لا من داخل التأثير
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/limits")
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);

  async function reset(key: string) {
    const res = await fetch("/api/admin/limits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? `صُفّرت نافذة ${key}` : (body.error ?? "تعذّر التصفير"));
    reload();
  }

  if (loading && !data) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  const windows = data?.windows ?? [];
  const ruleByScope = new Map((data?.rules ?? []).map((r) => [r.scope, r]));

  return (
    <div className="space-y-6">
      {message && <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm">{message}</p>}

      <Card
        title="الحدود المضبوطة"
        subtitle="تُعدَّل بمتغيرات البيئة RATE_LIMIT_* ثم إعادة النشر"
        actions={
          <button onClick={reload} className="rounded-xl border border-border-soft px-3 py-1.5 text-xs text-muted hover:text-body">
            ↻ تحديث
          </button>
        }
      >
        <Table head={["الخدمة", "لكل زائر", "لكل مسجّل", "سقف المنصة", "النافذة", "كلفة الحدث"]}>
          {(data?.rules ?? []).map((r) => (
            <tr key={r.scope}>
              <td className="px-3 py-2 font-semibold">
                {r.label}
                <span className="ms-2 font-mono text-[10px] text-muted">{r.scope}</span>
              </td>
              <td className="px-3 py-2 tabular-nums">{r.perVisitor}</td>
              <td className="px-3 py-2 tabular-nums text-primary">{r.perSignedIn}</td>
              <td className="px-3 py-2 tabular-nums">{r.global}</td>
              <td className="px-3 py-2 text-muted">{humanWindow(r.windowSec)}</td>
              <td className="px-3 py-2 tabular-nums text-muted">{fmtUsd(r.estimatedUsdPerEvent)}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="النوافذ النشطة الآن" subtitle="الاستهلاك الجاري لكل مفتاح — صفّر أي مفتاح لفك الحظر فوراً">
        {windows.length === 0 ? (
          <p className="py-4 text-sm text-muted">
            {data?.configured === false
              ? "الحدود تعمل بذاكرة الخادم (بلا Supabase) فلا يمكن عرض النوافذ."
              : "لا نوافذ نشطة الآن."}
          </p>
        ) : (
          <Table head={["المفتاح", "النطاق", "المستهلك", "الحد", "يتصفّر بعد", ""]}>
            {windows.map((w) => {
              const rule = ruleByScope.get(w.scope);
              const cap = w.subject === "global" ? rule?.global : w.subject === "user" ? rule?.perSignedIn : rule?.perVisitor;
              const ratio = cap ? w.count / cap : 0;
              return (
                <tr key={w.key}>
                  <td className="px-3 py-2 font-mono text-[11px] break-all">{w.key}</td>
                  <td className="px-3 py-2 text-xs">
                    {w.subject === "global" ? <Badge tone="info">سقف عام</Badge> : w.subject === "user" ? "مستخدم" : "زائر"}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    <Badge tone={ratio >= 1 ? "critical" : ratio >= 0.7 ? "warn" : "neutral"}>{fmtNum(w.count)}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted">{cap ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">
                    {w.resetInSec > 60 ? `${Math.round(w.resetInSec / 60)} دقيقة` : `${w.resetInSec} ثانية`}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => reset(w.key)}
                      className="rounded-lg border border-border-soft px-3 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-body"
                    >
                      صفّر
                    </button>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
