"use client";

import { useEffect, useMemo, useState } from "react";
import type { AdminCustomVoice, Configured } from "@/lib/admin/types";
import { Badge, Card, RankedBars, StatTile, Table, fmtDate, fmtNum } from "./ui";

type CatalogVoice = {
  id: string;
  name: string;
  gender: "male" | "female";
  dialect: string;
  provider: string;
  tone: string;
  available: boolean;
};

type VoicesResponse = {
  summary: {
    total: number;
    available: number;
    elevenlabs: number;
    azure: number;
    male: number;
    female: number;
    dialects: number;
    byDialect: Record<string, number>;
  };
  catalog: CatalogVoice[];
  custom: Configured<{ voices: AdminCustomVoice[] }>;
  scores: Configured<{ scores: { voiceId: string; count: number; average: number }[] }>;
};

/** كتالوج الأصوات كاملاً + بنك الأصوات المستنسخة والمصممة */
export default function VoicesTab() {
  const [data, setData] = useState<VoicesResponse | null>(null);
  const [dialect, setDialect] = useState("الكل");

  useEffect(() => {
    fetch("/api/admin/voices")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  const dialects = useMemo(
    () => ["الكل", ...Object.keys(data?.summary.byDialect ?? {})],
    [data]
  );

  if (!data) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  const rows = dialect === "الكل" ? data.catalog : data.catalog.filter((v) => v.dialect === dialect);
  const custom = data.custom.configured ? data.custom.voices : [];
  const scoreById = new Map(
    (data.scores.configured ? data.scores.scores : []).map((s) => [s.voiceId, s])
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="أصوات الكتالوج" value={data.summary.total} hint={`${data.summary.available} متاح بالمفاتيح الحالية`} />
        <StatTile label="اللهجات المغطّاة" value={data.summary.dialects} />
        <StatTile label="ذكور / إناث" value={`${data.summary.male} / ${data.summary.female}`} />
        <StatTile label="أصوات مستنسخة ومصممة" value={custom.length} hint="بنك الأصوات المتنامي" />
      </div>

      <Card title="التغطية حسب اللهجة">
        <RankedBars
          rows={Object.entries(data.summary.byDialect)
            .map(([label, value]) => ({ label, value, suffix: "صوت" }))
            .sort((a, b) => b.value - a.value)}
        />
      </Card>

      <Card
        title="كتالوج الأصوات"
        subtitle={`${fmtNum(rows.length)} صوتاً`}
        actions={
          <select
            value={dialect}
            onChange={(e) => setDialect(e.target.value)}
            className="rounded-xl border border-border-soft bg-surface-raised px-3 py-1.5 text-sm outline-none focus:border-primary"
          >
            {dialects.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        }
      >
        <Table head={["الصوت", "اللهجة", "النوع", "المحرك", "الطابع", "التقييم", "الحالة"]}>
          {rows.map((v) => {
            const score = scoreById.get(v.id);
            return (
              <tr key={v.id}>
                <td className="px-3 py-2 font-semibold">{v.name}</td>
                <td className="px-3 py-2 text-muted">{v.dialect}</td>
                <td className="px-3 py-2 text-muted">{v.gender === "male" ? "ذكر" : "أنثى"}</td>
                <td className="px-3 py-2 text-xs">{v.provider}</td>
                <td className="px-3 py-2 text-xs text-muted">{v.tone}</td>
                <td className="px-3 py-2 tabular-nums text-gold">{score ? `${score.average} ★ (${score.count})` : "—"}</td>
                <td className="px-3 py-2">
                  <Badge tone={v.available ? "good" : "warn"}>{v.available ? "متاح" : "يحتاج مفتاحاً"}</Badge>
                </td>
              </tr>
            );
          })}
        </Table>
      </Card>

      <Card title="بنك الأصوات المخصصة" subtitle="أصوات استنسخها أو صمّمها المستخدمون">
        {custom.length === 0 ? (
          <p className="py-4 text-sm text-muted">لا أصوات مخصصة بعد</p>
        ) : (
          <Table head={["الاسم", "المعرّف", "المالك", "التاريخ"]}>
            {custom.map((v) => (
              <tr key={v.id}>
                <td className="px-3 py-2 font-semibold">{v.name}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{v.id.slice(0, 12)}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted">{v.userId?.slice(0, 8) ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted">{fmtDate(v.createdAt)}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
