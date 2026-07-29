import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** هل ضُبطت مفاتيح Supabase؟ إنشاء العميل بدونها يرمي استثناءً */
export function supabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** عميل Supabase على الخادم — يقرأ جلسة المستخدم من الكوكيز ويخضع لسياسات RLS */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // الاستدعاء من Server Component — تحديث الجلسة يتم في middleware
          }
        },
      },
    }
  );
}

/**
 * عميل إداري يتجاوز RLS — للكتابة الموثوقة من الخادم فقط
 * (خصم الكريدت، تسجيل الاستهلاك). لا يُستخدم أبداً في كود المتصفح.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** المستخدم الحالي أو null */
export async function getUser() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}
