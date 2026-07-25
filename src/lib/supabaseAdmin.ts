import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * عميل Supabase الخادمي بمفتاح الخدمة (Service Role) — للمهام الدائمة
 * وتحديد معدل الاستخدام والحفظ الخادمي. لا يصل إلى المتصفح أبداً،
 * ويعيد null عندما تكون المنصة غير مهيأة فترجع الأنظمة لبدائل الذاكرة.
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let client: SupabaseClient | null | undefined;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (client === undefined) {
    client =
      URL && SERVICE_KEY
        ? createClient(URL, SERVICE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
  }
  return client;
}
