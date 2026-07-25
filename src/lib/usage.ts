import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * سجل الاستهلاك — أثر كل استخدام فعلي للمحركات المدفوعة (لا يشمل الوضع التجريبي).
 * يغذي ملخص الاستخدام في مكتبة المستخدم ويتيح مراقبة كلفة المنصة.
 * لا يعطّل الطلب أبداً: بلا Supabase أو عند فشل الإدراج يُسجَّل تحذير فقط.
 */
export async function logUsage(route: string, userId: string | null, cost = 1): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.from("usage_events").insert({ user_id: userId, route, cost });
  if (error) console.error("usage log failed:", error.message);
}

export type UsageSummary = {
  /** إجمالي أحداث آخر ٣٠ يوماً */
  monthTotal: number;
  /** تفصيل آخر ٣٠ يوماً حسب المسار */
  byRoute: Record<string, number>;
};

/** ملخص استهلاك مستخدم لآخر ٣٠ يوماً — يعيد أصفاراً بلا Supabase */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const empty: UsageSummary = { monthTotal: 0, byRoute: {} };
  const admin = getSupabaseAdmin();
  if (!admin) return empty;

  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const { data, error } = await admin
    .from("usage_events")
    .select("route, cost")
    .eq("user_id", userId)
    .gte("created_at", since)
    .limit(5000);
  if (error || !data) return empty;

  const byRoute: Record<string, number> = {};
  let monthTotal = 0;
  for (const row of data) {
    const cost = Number(row.cost) || 1;
    byRoute[row.route] = (byRoute[row.route] ?? 0) + cost;
    monthTotal += cost;
  }
  return { monthTotal, byRoute };
}
