import { NextRequest, NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { facebookConfig, facebookRedirectUri } from "@/lib/facebook/config";
import { verifyState } from "@/lib/facebook/crypto";
import { exchangeCode, listManagedPages, toLongLivedToken } from "@/lib/facebook/graph";
import { savePages } from "@/lib/facebook/pages";
import { STATE_COOKIE } from "../login/route";

/** ثلاث نداءات متتابعة إلى فيسبوك قد تستغرق ثوانٍ */
export const maxDuration = 60;

/** نهاية الربط: رمز التفويض ← رمز طويل الأجل ← رموز الصفحات المخزّنة مشفّرة */
export async function GET(req: NextRequest) {
  const back = (status: string, detail?: string) => {
    const url = new URL("/library", req.url);
    url.searchParams.set("facebook", status);
    if (detail) url.searchParams.set("reason", detail.slice(0, 160));
    const response = NextResponse.redirect(url);
    response.cookies.delete(STATE_COOKIE);
    return response;
  };

  const cfg = facebookConfig();
  if (!cfg || !supabaseConfigured()) return back("unavailable");

  // المستخدم ألغى الموافقة من نافذة فيسبوك
  const params = req.nextUrl.searchParams;
  if (params.get("error")) {
    return back("cancelled", params.get("error_description") ?? undefined);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back("failed", "استجابة ناقصة من فيسبوك");

  // الحالة موقّعة بسرّنا، والقيمة العشوائية داخلها تطابق الكوكي التي أصدرناها
  const payload = verifyState(state, cfg.appSecret);
  const nonce = req.cookies.get(STATE_COOKIE)?.value;
  if (!payload || !nonce) return back("failed", "حالة غير صالحة");

  const [stateUserId, stateNonce] = payload.split("|");
  if (stateNonce !== nonce) return back("failed", "حالة غير مطابقة");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== stateUserId) return back("failed", "الجلسة تغيّرت أثناء الربط");

  try {
    const shortToken = await exchangeCode(cfg, code, facebookRedirectUri(req));
    const { token: longToken } = await toLongLivedToken(cfg, shortToken);
    const pages = await listManagedPages(cfg, longToken);

    if (!pages.length) return back("nopages");

    await savePages(user.id, pages, cfg.tokenSecret);
    return back("connected");
  } catch (e) {
    console.error("facebook connect failed:", e);
    return back("failed", e instanceof Error ? e.message : undefined);
  }
}
