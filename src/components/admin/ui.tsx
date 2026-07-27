"use client";

import type { ReactNode } from "react";

/**
 * لبنات لوحة المالك — بطاقات وأرقام ومخططات صغيرة بنفس هوية الموقع.
 * كل المخططات ذات سلسلة واحدة (مقدار)، فتستخدم تدرّجاً بلون واحد بدل
 * ألوان متعددة، وتترك الألوان المحجوزة (أخضر/كهرماني/أحمر) للحالات فقط.
 */

/** أرقام لاتينية بفواصل آلاف — أوضح للقراءة المالية وأثبت في الجداول */
export const fmtNum = (n: number) => n.toLocaleString("en-US");
export const fmtUsd = (n: number) => `$${n.toFixed(2)}`;

export const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("ar", { day: "numeric", month: "short" });

export function Card({
  title,
  subtitle,
  actions,
  children,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface-card p-5">
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-bold">{title}</h2>}
            {subtitle && <p className="mt-1 text-xs text-muted">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export type Tone = "neutral" | "good" | "warn" | "critical" | "info";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border-soft text-muted",
  good: "border-success/40 bg-success/10 text-emerald-800",
  warn: "border-gold/50 bg-gold/10 text-amber-800",
  critical: "border-primary/40 bg-rose text-primary-strong",
  info: "border-primary/40 bg-primary/10 text-primary",
};

/** شارة حالة — دائماً بنص إلى جانب اللون، فلا تعتمد الهوية على اللون وحده */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2 py-0.5 text-xs ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

/** رقم رئيسي واحد — الشكل الصحيح لقيمة مفردة بلا مقارنة */
export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  const accent =
    tone === "good" ? "text-success" : tone === "warn" ? "text-amber-700" : tone === "critical" ? "text-primary-strong" : "text-body";
  return (
    <div className="rounded-2xl border border-border-soft bg-surface-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${accent}`}>
        {typeof value === "number" ? fmtNum(value) : value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

/**
 * مخطط أعمدة يومي — سلسلة واحدة (عدد الأحداث)، محور واحد،
 * وتلميح عند المرور بدل كتابة رقم فوق كل عمود.
 */
export function DailyBars({ data }: { data: { date: string; events: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.events));
  if (!data.length) return <p className="text-sm text-muted">لا توجد بيانات بعد</p>;

  return (
    <div>
      <div className="flex h-40 items-end gap-1" role="img" aria-label="الاستهلاك اليومي">
        {data.map((d) => (
          // h-full ضرورية: بدونها لا يجد ارتفاع العمود النسبي مرجعاً فيختفي المخطط
          <div key={d.date} className="group relative flex h-full flex-1 items-end justify-center">
            <div
              // max-w تُبقي الأعمدة نحيلة في المدد القصيرة بدل شرائح عريضة
              className="w-full max-w-10 rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
              style={{ height: `${Math.max(2, (d.events / max) * 100)}%` }}
            />
            <span className="pointer-events-none absolute bottom-full mb-1 hidden whitespace-nowrap rounded-lg border border-border-soft bg-surface-raised px-2 py-1 text-[11px] text-body shadow-lg group-hover:block">
              {fmtDay(d.date)}: {fmtNum(d.events)}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{fmtDay(data[0].date)}</span>
        <span>ذروة {fmtNum(max)} / يوم</span>
        <span>{fmtDay(data[data.length - 1].date)}</span>
      </div>
    </div>
  );
}

/** أعمدة أفقية للمقارنة بين المسارات — مرتبة تنازلياً مع قيمة مكتوبة */
export function RankedBars({
  rows,
}: {
  rows: { label: string; value: number; suffix?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="text-sm text-muted">لا توجد بيانات بعد</p>;

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted">
              {fmtNum(r.value)}
              {r.suffix ? ` ${r.suffix}` : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** جدول بسيط بعناوين — يمرّر أفقياً على الشاشات الصغيرة بلا كسر الصفحة */
export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-right text-sm">
        <thead>
          <tr className="border-b border-border-soft text-xs text-muted">
            {head.map((h) => (
              <th key={h} className="px-3 py-2 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-soft/60">{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ icon, title, note }: { icon: string; title: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border-soft bg-surface-card/50 p-10 text-center">
      <span className="text-4xl">{icon}</span>
      <p className="mt-3 font-bold">{title}</p>
      {note && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{note}</p>}
    </div>
  );
}

/** رسالة «القاعدة غير مهيأة» الموحّدة */
export function NotConfigured({ what }: { what: string }) {
  return (
    <EmptyState
      icon="🔌"
      title={`${what} يحتاج Supabase`}
      note="أضف NEXT_PUBLIC_SUPABASE_URL وSUPABASE_SERVICE_ROLE_KEY في بيئة الخادم لتظهر هذه البيانات."
    />
  );
}

export function Toggle({
  label,
  note,
  checked,
  onChange,
  danger,
}: {
  label: string;
  note?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-soft p-4 transition-colors hover:border-primary/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 accent-current"
      />
      <span>
        <span className={`font-semibold ${danger && checked ? "text-amber-700" : ""}`}>{label}</span>
        {note && <span className="mt-1 block text-xs leading-relaxed text-muted">{note}</span>}
      </span>
    </label>
  );
}
