"use client";

import { useEffect, useState } from "react";
import type { Configured, ContentStats, UsageStats } from "@/lib/admin/types";
import { Card, DailyBars, NotConfigured, RankedBars, StatTile, Table, fmtNum, fmtUsd } from "./ui";

type StatsResponse = {
  usage: UsageStats;
  content: Configured<ContentStats>;
  voiceScores: Configured<{ scores: { voiceId: string; count: number; average: number }[] }>;
};

const PERIODS = [
  { days: 1, label: "اليوم" },
  { days: 7, label: "٧ أيام" },
  { days: 30, label: "٣٠ يوماً" },
  { days: 90, label: "٩٠ يوماً" },
];

/** تفصيل الاستهلاك والكلفة التقديرية لكل خدمة، مع مدة يختارها المالك */
export default function UsageTab({ voiceName }: { voiceName: (id: string) => string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/stats?days=${days}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [days]);

  const usage = data?.usage.configured ? data.usage : null;
  // التحديث جارٍ ما دامت البيانات المعروضة لمدة غير المختارة — مشتقّ بلا حالة إضافية
  const refreshing = !loading && !!usage && usage.days !== days;
  const content = data?.content.configured ? data.content : null;
  const scores = data?.voiceScores.configured ? data.voiceScores.scores : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.days}
            onClick={() => setDays(p.days)}
            className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
              days === p.days ? "border-primary bg-primary/10 font-semibold text-body" : "border-border-soft text-muted hover:text-body"
            }`}
          >
            {p.label}
          </button>
        ))}
        {(loading || refreshing) && <span className="text-xs text-muted">جارٍ التحديث…</span>}
      </div>

      {!loading && !usage ? (
        <NotConfigured what="سجل الاستهلاك" />
      ) : (
        usage && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="إجمالي الأحداث" value={usage.total} />
              <StatTile label="الكلفة التقديرية" value={fmtUsd(usage.estimatedUsd)} hint="تقدير من أسعار المزوّدين، لا فاتورة" />
              <StatTile label="مستخدمون نشطون" value={usage.activeUsers} />
              <StatTile
                label="نسبة الزوار غير المسجلين"
                value={usage.total ? `${Math.round((usage.anonymousEvents / usage.total) * 100)}%` : "—"}
                hint={`${fmtNum(usage.anonymousEvents)} حدث بلا حساب`}
              />
            </div>

            <Card title="الاستهلاك اليومي" subtitle={`آخر ${usage.days} يوماً`}>
              <DailyBars data={usage.byDay} />
            </Card>

            <Card title="التفصيل حسب الخدمة" subtitle="العدد والكلفة التقديرية">
              <Table head={["الخدمة", "المسار", "الأحداث", "الكلفة التقديرية", "الحصة"]}>
                {usage.byRoute.map((r) => (
                  <tr key={r.route}>
                    <td className="px-3 py-2 font-semibold">{r.label}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted">{r.route}</td>
                    <td className="px-3 py-2 tabular-nums">{fmtNum(r.events)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">{fmtUsd(r.estimatedUsd)}</td>
                    <td className="px-3 py-2 tabular-nums text-muted">
                      {usage.total ? `${Math.round((r.events / usage.total) * 100)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="أكثر المستخدمين استهلاكاً" subtitle="خلال المدة المختارة">
                {usage.topUsers.length ? (
                  <RankedBars rows={usage.topUsers.map((u) => ({ label: u.userId.slice(0, 8), value: u.events, suffix: "حدث" }))} />
                ) : (
                  <p className="text-sm text-muted">لا استهلاك من مستخدمين مسجّلين بعد</p>
                )}
              </Card>

              <Card title="ترتيب الأصوات بالتقييم" subtitle="وقود الضبط الذاتي في عقل المنصة">
                {scores.length ? (
                  <Table head={["الصوت", "متوسط", "عدد"]}>
                    {scores.map((s) => (
                      <tr key={s.voiceId}>
                        <td className="px-3 py-2">{voiceName(s.voiceId)}</td>
                        <td className="px-3 py-2 tabular-nums text-gold">{s.average} ★</td>
                        <td className="px-3 py-2 tabular-nums text-muted">{s.count}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <p className="text-sm text-muted">لم تُسجَّل تقييمات بعد</p>
                )}
              </Card>
            </div>

            {content && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card title="الأعمال المحفوظة حسب النوع">
                  <RankedBars
                    rows={Object.entries(content.generations.byKind).map(([k, v]) => ({
                      label: k === "tts" ? "نص إلى صوت" : k === "song" ? "أغانٍ وموسيقى" : k === "recording" ? "تسجيلات" : k,
                      value: v,
                    }))}
                  />
                </Card>
                <Card title="الأعمال حسب المحرك المنتج">
                  <RankedBars
                    rows={Object.entries(content.generations.byProvider).map(([k, v]) => ({ label: k, value: v }))}
                  />
                </Card>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}
