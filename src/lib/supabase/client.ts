import { createBrowserClient } from "@supabase/ssr";

/** عميل Supabase في المتصفح — يستخدم المفتاح العام المقيّد بسياسات RLS */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** هل إعدادات Supabase متوفرة؟ تُستخدم لإخفاء واجهات الحسابات عند غيابها */
export const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
