"use client";

import { useEffect, useState } from "react";
import type { AuditEntry, LimitRuleRow, PlatformSettings } from "@/lib/admin/types";
import { Card, Table, Toggle, fmtDate } from "./ui";

/**
 * مفاتيح التحكم الحيّة — تسري على كل الخوادم خلال ثوانٍ بلا إعادة نشر،
 * مع سجل تدقيق يوضّح من غيّر ماذا ومتى.
 */
export default function ControlTab({
  settings,
  limits,
  onSaved,
}: {
  settings: PlatformSettings;
  limits: LimitRuleRow[];
  onSaved: (s: PlatformSettings) => void;
}) {
  // النسخة المحفوظة والمسودة معاً محلياً: الفرق بينهما هو «تغييرات غير محفوظة»
  const [saved, setSaved] = useState<PlatformSettings>(settings);
  const [draft, setDraft] = useState<PlatformSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/audit?limit=30")
      .then((r) => r.json())
      .then((d) => !cancelled && d.configured && setAudit(d.entries))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maintenance: draft.maintenance,
        maintenanceMessage: draft.maintenanceMessage,
        forceMock: draft.forceMock,
        disabledRoutes: draft.disabledRoutes,
        banner: draft.banner,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setMessage(body.error ?? "تعذّر الحفظ");
      return;
    }
    setSaved(body);
    setDraft(body);
    onSaved(body);
    setMessage("حُفظت الإعدادات وسرت على كل الخوادم");
  }

  function toggleRoute(scope: string, disabled: boolean) {
    setDraft((d) => ({
      ...d,
      disabledRoutes: disabled ? [...d.disabledRoutes, scope] : d.disabledRoutes.filter((r) => r !== scope),
    }));
  }

  return (
    <div className="space-y-6">
      <Card title="مفاتيح الطوارئ" subtitle="تُطبَّق خلال ١٥ ثانية على كل نسخ الخادم">
        <div className="space-y-3">
          <Toggle
            danger
            label="وضع الصيانة — إيقاف كل التوليد"
            note="يمنع كل المسارات المكلفة فوراً ويعيد رسالتك أدناه للمستخدمين. الصمام الأخير لحماية المحفظة."
            checked={draft.maintenance}
            onChange={(v) => setDraft((d) => ({ ...d, maintenance: v }))}
          />
          <Toggle
            danger
            label="الوضع التجريبي القسري — بلا كلفة"
            note="الموقع يعمل كاملاً لكن بمحركات تجريبية محلية: صفر إنفاق على ElevenLabs وGemini، مفيد للعروض والاختبار."
            checked={draft.forceMock}
            onChange={(v) => setDraft((d) => ({ ...d, forceMock: v }))}
          />

          <div>
            <label className="mb-1 block text-sm text-muted">رسالة الصيانة</label>
            <input
              value={draft.maintenanceMessage}
              onChange={(e) => setDraft((d) => ({ ...d, maintenanceMessage: e.target.value }))}
              className="w-full rounded-xl border border-border-soft bg-surface-raised px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">لافتة أعلى الموقع (فارغة = مخفية)</label>
            <input
              value={draft.banner}
              onChange={(e) => setDraft((d) => ({ ...d, banner: e.target.value }))}
              placeholder="مثال: صيانة مجدولة الجمعة ١٠ مساءً"
              className="w-full rounded-xl border border-border-soft bg-surface-raised px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
      </Card>

      <Card title="إيقاف خدمة بعينها" subtitle="أوقف الخدمة الأغلى وحدها بدل إيقاف الموقع كله">
        <div className="grid gap-2 sm:grid-cols-2">
          {limits.map((r) => {
            const disabled = draft.disabledRoutes.includes(r.scope);
            return (
              <label
                key={r.scope}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                  disabled ? "border-red-500/40 bg-red-500/10" : "border-border-soft hover:border-primary/50"
                }`}
              >
                <span>
                  <span className="font-semibold">{r.label}</span>
                  <span className="ms-2 font-mono text-[10px] text-muted">{r.scope}</span>
                </span>
                <input
                  type="checkbox"
                  checked={disabled}
                  onChange={(e) => toggleRoute(r.scope, e.target.checked)}
                  className="h-4 w-4"
                />
              </label>
            );
          })}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={!dirty || saving}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-40"
        >
          {saving ? "جارٍ الحفظ…" : "احفظ وطبّق الآن"}
        </button>
        {dirty && <span className="text-xs text-amber-300">لديك تغييرات غير محفوظة</span>}
        {message && <span className="text-sm text-muted">{message}</span>}
        {saved.updatedAt && (
          <span className="text-xs text-muted">
            آخر تغيير: {fmtDate(saved.updatedAt)} بواسطة {saved.updatedBy ?? "—"}
          </span>
        )}
      </div>

      <Card title="سجل التدقيق" subtitle="كل إجراء إداري مسجّل باسم فاعله">
        {audit.length === 0 ? (
          <p className="py-4 text-sm text-muted">لا إجراءات مسجّلة بعد</p>
        ) : (
          <Table head={["الإجراء", "الهدف", "التفاصيل", "الفاعل", "التاريخ"]}>
            {audit.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{e.target?.slice(0, 16) ?? "—"}</td>
                <td className="px-3 py-2 text-[11px] text-muted">{JSON.stringify(e.details).slice(0, 80)}</td>
                <td className="px-3 py-2 text-xs">{e.actorEmail}</td>
                <td className="px-3 py-2 text-xs text-muted">{fmtDate(e.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
