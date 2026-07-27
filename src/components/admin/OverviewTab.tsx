"use client";

import type { Overview } from "@/lib/admin/types";
import { Badge, Card, DailyBars, RankedBars, StatTile, Table, fmtNum, fmtUsd } from "./ui";

/** الحالة العامة للنظام: هل كل شيء يعمل، وكم استُهلك، وأين الخلل */
export default function OverviewTab({ data }: { data: Overview }) {
  const today = data.usageToday.configured ? data.usageToday : null;
  const week = data.usageWeek.configured ? data.usageWeek : null;
  const content = data.content.configured ? data.content : null;

  const missingCritical = data.integrations.filter((i) => i.critical && !i.configured);
  const liveFeatures = data.features.filter((f) => f.state === "live").length;

  return (
    <div className="space-y-6">
      {/* تنبيهات تحتاج قراراً من المالك */}
      {(data.settings.maintenance || data.settings.forceMock || data.settings.disabledRoutes.length > 0) && (
        <div className="rounded-2xl border border-gold/50 bg-gold/10 p-4 text-sm text-amber-900">
          <p className="font-bold">⚠️ المنصة تعمل بوضع مقيّد الآن</p>
          <ul className="mt-2 space-y-1 text-amber-900/85">
            {data.settings.maintenance && <li>• وضع الصيانة مفعّل — كل التوليد متوقف للزوار.</li>}
            {data.settings.forceMock && <li>• الوضع التجريبي القسري مفعّل — لا كلفة على المزوّدين ولا مخرجات حقيقية.</li>}
            {data.settings.disabledRoutes.length > 0 && (
              <li>• مسارات موقوفة: {data.settings.disabledRoutes.join("، ")}</li>
            )}
          </ul>
        </div>
      )}

      {missingCritical.length > 0 && (
        <div className="rounded-2xl border border-primary/40 bg-rose p-4 text-sm text-primary-strong">
          <p className="font-bold">🔑 مفاتيح أساسية ناقصة</p>
          <p className="mt-1">
            {missingCritical.map((i) => `${i.name} (${i.envVars.join("، ")})`).join(" — ")} — الميزات المرتبطة بها تعمل
            بالوضع التجريبي أو معطّلة.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="أحداث اليوم" value={today?.total ?? 0} hint={today ? `تقديري ${fmtUsd(today.estimatedUsd)}` : "بلا قاعدة بيانات"} />
        <StatTile label="أحداث آخر ٧ أيام" value={week?.total ?? 0} hint={week ? `تقديري ${fmtUsd(week.estimatedUsd)}` : undefined} />
        <StatTile label="مستخدمون مسجّلون" value={content?.users.total ?? 0} hint={content ? `+${content.users.newLast7Days} هذا الأسبوع` : undefined} />
        <StatTile
          label="ميزات تعمل بمحرك حقيقي"
          value={`${liveFeatures}/${data.features.length}`}
          tone={liveFeatures >= data.features.length - 2 ? "good" : "warn"}
        />
      </div>

      {week && (
        <Card title="الاستهلاك اليومي" subtitle="عدد الأحداث المدفوعة خلال آخر ٧ أيام">
          <DailyBars data={week.byDay} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="حالة الميزات" subtitle="ما الذي يعمل بمحرك حقيقي الآن">
          <ul className="space-y-2">
            {data.features.map((f) => (
              <li key={f.id} className="flex items-start justify-between gap-3 border-b border-border-soft/50 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{f.name}</p>
                  <p className="mt-0.5 text-xs text-muted">{f.note}</p>
                </div>
                <Badge tone={f.state === "live" ? "good" : f.state === "mock" ? "warn" : "critical"}>
                  {f.state === "live" ? "✓ حيّ" : f.state === "mock" ? "◐ تجريبي" : "✕ معطّل"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="التكاملات والمفاتيح" subtitle="وجود المفتاح فقط — لا تُعرض قيمته أبداً">
          <ul className="space-y-2">
            {data.integrations.map((i) => (
              <li key={i.id} className="flex items-start justify-between gap-3 border-b border-border-soft/50 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {i.name}
                    {i.critical && <span className="ms-2 text-[10px] text-muted">أساسي</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{i.powers.join(" · ")}</p>
                  {i.model && <p className="mt-0.5 text-[11px] text-muted/80">النموذج: {i.model}</p>}
                </div>
                <Badge tone={i.configured ? "good" : i.critical ? "critical" : "warn"}>
                  {i.configured ? "✓ مضبوط" : "✕ ناقص"}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {week && week.byRoute.length > 0 && (
          <Card title="أكثر الخدمات استهلاكاً" subtitle="آخر ٧ أيام">
            <RankedBars rows={week.byRoute.map((r) => ({ label: r.label, value: r.events, suffix: "حدث" }))} />
          </Card>
        )}

        {content && (
          <Card title="المخرجات المحفوظة" subtitle="مكتبات المستخدمين ومهام التوليد">
            <div className="grid grid-cols-2 gap-3">
              <StatTile label="أعمال محفوظة" value={content.generations.total} />
              <StatTile label="أصوات مخصصة" value={content.customVoices} />
              <StatTile
                label="متوسط التقييم"
                value={content.ratings.average === null ? "—" : `${content.ratings.average} / 5`}
                hint={`${fmtNum(content.ratings.count)} تقييم`}
              />
              <StatTile
                label="مهام فاشلة"
                value={content.jobs.byStatus.failed ?? 0}
                tone={(content.jobs.byStatus.failed ?? 0) > 0 ? "critical" : "good"}
                hint={`من ${fmtNum(content.jobs.total)} مهمة`}
              />
            </div>
          </Card>
        )}
      </div>

      <Card title="بيئة التشغيل" subtitle="النشرة العاملة الآن">
        <Table head={["البند", "القيمة"]}>
          {[
            ["البيئة", data.runtime.environment],
            ["إصدار Node", data.runtime.nodeVersion],
            ["المنطقة", data.runtime.region ?? "—"],
            ["الفرع", data.runtime.branch ?? "—"],
            ["الإصدار (commit)", data.runtime.commit ?? "—"],
            ["عنوان النشر", data.runtime.deploymentUrl ?? "—"],
            ["مالكو النظام", `${data.owner.count} — ${data.owner.masked.join("، ")}`],
            ["أصوات الكتالوج", `${data.catalogs.voices.total} صوت (${data.catalogs.voices.available} متاح الآن) بـ ${data.catalogs.voices.dialects} لهجة`],
            ["المقامات", `${data.catalogs.maqamat.length} مقاماً`],
          ].map(([k, v]) => (
            <tr key={k}>
              <td className="px-3 py-2 text-muted">{k}</td>
              <td className="px-3 py-2 break-all">{v}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
