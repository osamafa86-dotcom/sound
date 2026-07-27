/**
 * حسابات لوحة المالك — دوال خالصة تعمل على صفوف جاهزة، بلا أي وصول للشبكة،
 * ليسهل اختبارها والتأكد من أرقامها (المالك يتخذ قرارات مالية بناءً عليها).
 */

export type UsageRow = {
  route: string;
  cost: number | null;
  user_id: string | null;
  created_at: string;
};

/** أسماء المسارات بالعربية كما تظهر في اللوحة */
export const ROUTE_LABELS: Record<string, string> = {
  tts: "النص إلى صوت",
  songs: "توليد الأغاني",
  lyrics: "مساعد الكلمات",
  stt: "التفريغ النصي",
  sts: "تحويل صوت إلى صوت",
  voiceClone: "استنساخ الصوت",
  voiceDesign: "تصميم الأصوات",
  pronunciation: "ذاكرة النطق",
  enhance: "تحسين النص",
  imageBrief: "الموسيقى من صورة",
  drama: "الاستوديو الدرامي",
  podcast: "البودكاست",
  cover: "أغلفة الألبومات",
  karaoke: "الكاريوكي (توقيت الكلمات)",
  proofread: "تدقيق التشكيل",
  signals: "إشارات عقل المنصة",
};

/**
 * كلفة تقديرية بالدولار لكل حدث — مبنية على أسعار المزوّدين في PLAN.md.
 * تقديرية عمداً (الكلفة الحقيقية تتبع طول النص والمدة)، وتُعدَّل بمتغيرات
 * البيئة COST_<ROUTE> عند الرغبة بضبطها على الفواتير الفعلية.
 */
export const DEFAULT_ROUTE_COST_USD: Record<string, number> = {
  tts: 0.02,
  songs: 0.09,
  lyrics: 0.004,
  stt: 0.01,
  sts: 0.02,
  voiceClone: 0,
  voiceDesign: 0.01,
  pronunciation: 0.001,
  enhance: 0.003,
  imageBrief: 0.004,
  drama: 0.02,
  podcast: 0.02,
  cover: 0.03,
  karaoke: 0.01,
  proofread: 0.004,
  // إشارات التعلم تُكتب في قاعدتنا فقط — بلا كلفة على أي مزوّد
  signals: 0,
};

/** كلفة المسار مع احترام تجاوز البيئة (COST_TTS=0.03 مثلاً) */
export function routeCostUsd(route: string): number {
  const override = Number(process.env[`COST_${route.toUpperCase()}`]);
  if (Number.isFinite(override) && override >= 0) return override;
  return DEFAULT_ROUTE_COST_USD[route] ?? 0;
}

export type RouteStat = {
  route: string;
  label: string;
  events: number;
  estimatedUsd: number;
};

export type UsageAggregate = {
  /** إجمالي الأحداث (بوزن cost — سطر الدراما الواحد قد يساوي عدة أحداث) */
  total: number;
  byRoute: RouteStat[];
  /** سلسلة يومية كاملة بلا فجوات، الأقدم أولاً */
  byDay: { date: string; events: number }[];
  /** عدد المستخدمين المسجلين الذين ولّدوا شيئاً خلال المدة */
  activeUsers: number;
  /** أحداث الزوار غير المسجلين */
  anonymousEvents: number;
  signedInEvents: number;
  estimatedUsd: number;
  /** أكثر المستخدمين استهلاكاً */
  topUsers: { userId: string; events: number }[];
};

/** تاريخ يوم بصيغة YYYY-MM-DD بالتوقيت العالمي */
export function dayKey(ts: number | string): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** يبني قائمة أيام متصلة تنتهي باليوم الحالي */
export function dayRange(days: number, now: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    out.push(dayKey(now - i * 86_400_000));
  }
  return out;
}

export function aggregateUsage(rows: UsageRow[], days: number, now = Date.now()): UsageAggregate {
  const byRoute = new Map<string, number>();
  const byDay = new Map<string, number>(dayRange(days, now).map((d) => [d, 0]));
  const byUser = new Map<string, number>();

  let total = 0;
  let anonymousEvents = 0;

  for (const row of rows) {
    const weight = Number(row.cost) || 1;
    total += weight;
    byRoute.set(row.route, (byRoute.get(row.route) ?? 0) + weight);

    const day = dayKey(row.created_at);
    if (byDay.has(day)) byDay.set(day, (byDay.get(day) ?? 0) + weight);

    if (row.user_id) byUser.set(row.user_id, (byUser.get(row.user_id) ?? 0) + weight);
    else anonymousEvents += weight;
  }

  const routes: RouteStat[] = [...byRoute.entries()]
    .map(([route, events]) => ({
      route,
      label: ROUTE_LABELS[route] ?? route,
      events,
      estimatedUsd: round2(events * routeCostUsd(route)),
    }))
    .sort((a, b) => b.events - a.events);

  return {
    total,
    byRoute: routes,
    byDay: [...byDay.entries()].map(([date, events]) => ({ date, events })),
    activeUsers: byUser.size,
    anonymousEvents,
    signedInEvents: total - anonymousEvents,
    estimatedUsd: round2(routes.reduce((sum, r) => sum + r.estimatedUsd, 0)),
    topUsers: [...byUser.entries()]
      .map(([userId, events]) => ({ userId, events }))
      .sort((a, b) => b.events - a.events)
      .slice(0, 10),
  };
}

/** تقريب لأقرب سنتين — الأرقام المالية لا تُعرض بكسور طويلة */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** عدّاد بسيط لقيم عمود واحد (النوع، المزوّد، الحالة...) */
export function countBy<T>(rows: T[], pick: (row: T) => string | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const key = pick(row) ?? "غير محدد";
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

export type LimitWindowRow = { key: string; window_start: string; count: number };

export type LimitWindow = {
  key: string;
  scope: string;
  /** global أو user أو ip */
  subject: string;
  identifier: string;
  count: number;
  windowStart: string;
  /** ثوانٍ متبقية قبل تصفير النافذة (0 = انتهت) */
  resetInSec: number;
};

/** يفكّ مفاتيح جدول rate_limits إلى صفوف مقروءة في اللوحة */
export function parseLimitWindows(
  rows: LimitWindowRow[],
  windowSecFor: (scope: string) => number,
  now = Date.now()
): LimitWindow[] {
  return rows
    .map((row) => {
      const [scope, subject = "global", ...rest] = row.key.split(":");
      const started = new Date(row.window_start).getTime();
      const windowSec = windowSecFor(scope);
      const elapsed = (now - started) / 1000;
      return {
        key: row.key,
        scope,
        subject,
        identifier: rest.join(":"),
        count: row.count,
        windowStart: row.window_start,
        resetInSec: Math.max(0, Math.round(windowSec - elapsed)),
      };
    })
    .sort((a, b) => b.count - a.count);
}
