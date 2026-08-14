"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Overview, PlatformSettings } from "@/lib/admin/types";
import { VOICES } from "@/lib/voices";
import { Badge, EmptyState } from "@/components/admin/ui";
import OverviewTab from "@/components/admin/OverviewTab";
import UsageTab from "@/components/admin/UsageTab";
import UsersTab from "@/components/admin/UsersTab";
import JobsTab from "@/components/admin/JobsTab";
import LimitsTab from "@/components/admin/LimitsTab";
import VoicesTab from "@/components/admin/VoicesTab";
import ControlTab from "@/components/admin/ControlTab";
import SupportTab from "@/components/admin/SupportTab";

/**
 * لوحة مالك النظام — كل خصائص المنصة وتفاصيلها في مكان واحد:
 * الصحة والتكاملات، الاستهلاك والكلفة، المستخدمون، المهام، الحدود،
 * الأصوات، ومفاتيح التحكم الحيّة.
 *
 * الحماية الحقيقية في الخادم (requireOwner على كل مسار)؛ هذه الصفحة
 * لا تعرض شيئاً قبل أن يوافق الخادم.
 */

const TABS = [
  { id: "overview", label: "نظرة عامة", icon: "📊" },
  { id: "usage", label: "الاستهلاك والكلفة", icon: "💸" },
  { id: "users", label: "المستخدمون", icon: "👥" },
  { id: "jobs", label: "المهام", icon: "⚙️" },
  { id: "limits", label: "الحدود", icon: "🛡️" },
  { id: "voices", label: "الأصوات", icon: "🎙️" },
  { id: "support", label: "الدعم", icon: "💌" },
  { id: "control", label: "التحكم", icon: "🎛️" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const voiceName = (id: string) => VOICES.find((v) => v.id === id)?.name ?? id;

export default function AdminDashboard() {
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<{ status: number; message: string; signedInAs?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // زيادة الرمز تعيد الجلب — زر التحديث يطلبه، لا التأثير نفسه
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/overview");
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok)
          setError({
            status: res.status,
            message: body.error ?? "تعذّر تحميل اللوحة",
            signedInAs: body.signedInAs,
          });
        else {
          setData(body);
          setError(null);
        }
      } catch {
        if (!cancelled) setError({ status: 0, message: "تعذّر الاتصال بالخادم" });
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  function onSettingsSaved(settings: PlatformSettings) {
    setData((prev) => (prev ? { ...prev, settings } : prev));
  }

  if (loading) {
    return <div className="py-24 text-center text-muted">جارٍ تحميل لوحة النظام…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <EmptyState
          icon={error.status === 403 ? "🚫" : error.status === 401 ? "🔐" : "⚠️"}
          title={
            error.status === 403
              ? "هذه اللوحة لمالك النظام فقط"
              : error.status === 401
                ? "سجّل الدخول بحساب المالك"
                : "اللوحة غير متاحة"
          }
          note={
            error.signedInAs
              ? `${error.message} — أنت داخل الآن بحساب ${error.signedInAs}، وهو ليس ضمن OWNER_EMAILS.`
              : error.message
          }
        />
        <div className="mt-6 flex justify-center gap-3">
          {error.status === 401 && (
            <Link href="/" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-strong">
              تسجيل الدخول
            </Link>
          )}
          <Link href="/" className="rounded-xl border border-border-soft px-5 py-2.5 text-sm font-semibold hover:border-primary">
            العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">لوحة النظام</h1>
            <Badge tone="info">مالك</Badge>
            {data.settings.maintenance && <Badge tone="critical">صيانة</Badge>}
            {data.settings.forceMock && <Badge tone="warn">تجريبي قسري</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {data.viewer} · بيئة {data.runtime.environment}
            {data.runtime.commit && ` · إصدار ${data.runtime.commit}`}
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setReloadToken((t) => t + 1);
          }}
          className="rounded-xl border border-border-soft px-4 py-2 text-sm text-muted transition-colors hover:border-primary hover:text-body"
        >
          ↻ تحديث البيانات
        </button>
      </header>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-border-soft pb-px">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-t-xl px-4 py-2.5 text-sm transition-colors ${
              tab === t.id
                ? "border-b-2 border-primary font-semibold text-body"
                : "text-muted hover:text-body"
            }`}
          >
            <span aria-hidden className="ms-1">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab data={data} />}
        {tab === "usage" && <UsageTab voiceName={voiceName} />}
        {tab === "users" && <UsersTab />}
        {tab === "jobs" && <JobsTab />}
        {tab === "limits" && <LimitsTab />}
        {tab === "voices" && <VoicesTab />}
        {tab === "support" && <SupportTab />}
        {tab === "control" && (
          <ControlTab settings={data.settings} limits={data.limits} onSaved={onSettingsSaved} />
        )}
      </div>
    </div>
  );
}
