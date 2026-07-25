import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * عميل Supabase للمتصفح — يُنشأ مرة واحدة، ويعيد null عندما تكون
 * المنصة غير مهيأة (بدون متغيرات البيئة) فتعمل المكتبة بالوضع المحلي.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(URL && ANON_KEY);

let client: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (client === undefined) {
    client = URL && ANON_KEY ? createClient(URL, ANON_KEY) : null;
  }
  return client;
}
