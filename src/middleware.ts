import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, verifyGateToken } from "@/lib/siteGate";

const GATE_EXEMPT_PATHS = ["/gate", "/api/gate"];

/** تحديث جلسة Supabase على كل طلب حتى لا تنتهي أثناء التصفح */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // بوابة كلمة سر الموقع: تسبق كل شيء (حتى مسارات API) — تحمي أرصدة
  // المزوّدين المدفوعة من أي زائر لا يملك كلمة السر. صفحة البوابة ونقطة
  // التحقق نفسها مُستثناتان حتى يمكن الوصول إليهما لإدخال كلمة السر.
  if (!GATE_EXEMPT_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    const token = request.cookies.get(GATE_COOKIE)?.value;
    const authed = await verifyGateToken(token);
    if (!authed) {
      const url = request.nextUrl.clone();
      url.pathname = "/gate";
      url.search = "";
      url.searchParams.set("next", pathname + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav)$).*)"],
};
