"use client";

import { useEffect, useState } from "react";
import type { AdminJob } from "@/lib/admin/types";
import { Badge, Card, NotConfigured, Table, fmtDate, type Tone } from "./ui";

type JobsResponse = { configured: true; jobs: AdminJob[] } | { configured: false };

const FILTERS = [
  { value: "", label: "الكل" },
  { value: "running", label: "قيد التنفيذ" },
  { value: "pending", label: "بالانتظار" },
  { value: "done", label: "مكتملة" },
  { value: "failed", label: "فاشلة" },
];

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "بالانتظار", tone: "neutral" },
  running: { label: "قيد التنفيذ", tone: "info" },
  done: { label: "مكتملة", tone: "good" },
  failed: { label: "فاشلة", tone: "critical" },
};

/** مهام توليد الأغاني الحيّة — التشخيص السريع لأي فشل في الإنتاج */
export default function JobsTab() {
  const [status, setStatus] = useState("");
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  // زيادة الرمز تعيد تشغيل الجلب — الطلب من زر المستخدم لا من داخل التأثير
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/jobs?limit=100${status ? `&status=${status}` : ""}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [status, reloadToken]);

  const reload = () => setReloadToken((t) => t + 1);

  async function purge() {
    if (!confirm("حذف كل المهام الأقدم من يوم؟ لا يمكن التراجع.")) return;
    const res = await fetch("/api/admin/jobs?days=1", { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? `حُذفت ${body.deleted ?? 0} مهمة` : (body.error ?? "تعذّر التنظيف"));
    reload();
  }

  if (loading && !data) return <p className="text-sm text-muted">جارٍ التحميل…</p>;
  if (!data?.configured) return <NotConfigured what="سجل المهام" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatus(f.value)}
            className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
              status === f.value ? "border-primary bg-primary/10 font-semibold" : "border-border-soft text-muted hover:text-body"
            }`}
          >
            {f.label}
          </button>
        ))}
        <div className="ms-auto flex gap-2">
          <button onClick={reload} className="rounded-xl border border-border-soft px-4 py-2 text-sm text-muted hover:text-body">
            ↻ تحديث
          </button>
          <button
            onClick={purge}
            className="rounded-xl border border-red-500/40 px-4 py-2 text-sm text-red-300 transition-colors hover:bg-red-500/10"
          >
            تنظيف الأقدم من يوم
          </button>
        </div>
      </div>

      {message && <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm">{message}</p>}

      <Card>
        {data.jobs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">لا مهام في هذا التصنيف</p>
        ) : (
          <Table head={["المهمة", "الحالة", "المرحلة", "المستوى", "المحرك", "التاريخ"]}>
            {data.jobs.map((j) => (
              <tr key={j.id}>
                <td className="px-3 py-2">
                  <span className="font-mono text-[11px] text-muted">{j.id.slice(0, 8)}</span>
                  {j.userId ? (
                    <span className="ms-2 text-[11px] text-muted">مستخدم {j.userId.slice(0, 6)}</span>
                  ) : (
                    <span className="ms-2 text-[11px] text-muted">زائر</span>
                  )}
                  {j.error && <p className="mt-1 max-w-md text-xs text-red-300">{j.error}</p>}
                  {j.fellBack && <p className="mt-1 text-[11px] text-amber-300">رجوع تلقائي: {j.fellBack}</p>}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={STATUS[j.status]?.tone ?? "neutral"}>{STATUS[j.status]?.label ?? j.status}</Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted">{j.stage || "—"}</td>
                <td className="px-3 py-2 text-xs">{j.tier === "preview" ? "معاينة" : "كاملة"}</td>
                <td className="px-3 py-2 text-xs">
                  {j.provider ?? "—"}
                  {j.mock && <Badge tone="warn">تجريبي</Badge>}
                </td>
                <td className="px-3 py-2 text-xs text-muted">{fmtDate(j.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
