import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getEdgeSecurityState, verifyGateTokenEdge } from "@/lib/securityEdge";

/**
 * البوابة الديناميكية: صاحب الموقع يضيف/يزيل كلمة السر من صفحة /security
 * بلا نشر. لا كلمة سر مضبوطة = الموقع مفتوح والوسيط يمرّر مباشرة.
 * ملفات تثبيت التطبيق (PWA) ومسارات الدخول مستثناة دائماً.
 */
const GATE_EXEMPT = [
  "/gate",
  "/api/gate",
  "/api/security",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
];

const GATE_COOKIE = "mqaam_gate";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const exempt = GATE_EXEMPT.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (!exempt) {
    const state = await getEdgeSecurityState();
    if (state.protectedSite) {
      const token = request.cookies.get(GATE_COOKIE)?.value;
      // بطلب صاحب الموقع: كلمة السر تُطلب عند كل تنقل — طلبات التنقل
      // (وثيقة أو RSC) تشترط دخولاً طازجاً خلال ٢٥ ثانية، بينما نداءات
      // الصفحة المفتوحة (API) تبقى سارية فلا ينقطع عملها وأنت عليها
      const isNavigation =
        request.headers.get("sec-fetch-mode") === "navigate" ||
        !!request.headers.get("rsc") ||
        !!request.headers.get("next-router-prefetch");
      const authed = await verifyGateTokenEdge(token, state.secret, isNavigation ? 25 : undefined);
      if (!authed) {
        // طلبات RSC/الجلب المسبق: 401 غير قابلة للتخزين — التحويل يسمم كاش الراوتر
        if (request.headers.get("rsc") || request.headers.get("next-router-prefetch")) {
          return new NextResponse(null, { status: 401, headers: { "Cache-Control": "no-store" } });
        }
        const url = request.nextUrl.clone();
        url.pathname = "/gate";
        url.search = "";
        url.searchParams.set("next", pathname + request.nextUrl.search);
        const redirect = NextResponse.redirect(url);
        redirect.headers.set("Cache-Control", "no-store");
        return redirect;
      }
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
