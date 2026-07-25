import { createClient, supabaseConfigured } from "./supabase/client";

/**
 * واجهة توافق فوق عميل المتصفح الموحّد (@supabase/ssr بجلسة كوكيز):
 * getSupabase وauthHeaders تستخدمان نفس الجلسة التي تنشئها صفحات الدخول،
 * فتصل ترويسة Bearer نفسها إلى مسارات API لرفع حدود الاستخدام وربط الملكية.
 */

export { supabaseConfigured };

export const getSupabase = createClient;

/**
 * ترويسة المصادقة لطلبات API الداخلية — تمنح المستخدم المسجل حدود استخدام أعلى
 * وتربط توليداته وأصواته المستنسخة بحسابه. تعيد كائناً فارغاً لغير المسجلين.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
