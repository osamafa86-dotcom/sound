import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** هل إعدادات Supabase متوفرة؟ تُستخدم لإخفاء واجهات الحسابات عند غيابها */
export const supabaseConfigured = !!URL && !!ANON_KEY;

let cached: SupabaseClient | null = null;

/**
 * عميل Supabase في المتصفح — يعيد null إذا لم تُضبط المفاتيح،
 * حتى لا ينهار الموقع كله عند غياب الإعداد (الحسابات ميزة اختيارية).
 */
export function createClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!cached) cached = createBrowserClient(URL!, ANON_KEY!);
  return cached;
}
