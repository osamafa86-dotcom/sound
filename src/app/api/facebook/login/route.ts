import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { facebookConfig, facebookRedirectUri } from "@/lib/facebook/config";
import { signState } from "@/lib/facebook/crypto";
import { authorizeUrl } from "@/lib/facebook/graph";

/** اسم كوكي الحالة — يُقارن بما يعود من فيسبوك فيمنع تزوير رحلة الموافقة */
export const STATE_COOKIE = "fb_oauth_state";

/** بداية الربط: تحويل المستخدم إلى نافذة موافقة فيسبوك */
export async function GET(req: NextRequest) {
  const cfg = facebookConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "النشر على فيسبوك غير مفعّل — يحتاج FACEBOOK_APP_ID وFACEBOOK_APP_SECRET" },
      { status: 503 }
    );
  }
  // الربط يُخزَّن لحساب مستخدم، فلا معنى له بلا حسابات
  if (!supabaseConfigured()) {
    return NextResponse.json(
      { error: "الربط يحتاج حسابات المنصة — اضبط مفاتيح Supabase أولاً" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login?next=/library", req.url));
  }

  // الحالة تحمل هوية الطالب وقيمة عشوائية، موقّعتين بسرّ التطبيق
  const nonce = randomUUID();
  const state = signState(`${user.id}|${nonce}`, cfg.appSecret);

  const response = NextResponse.redirect(
    authorizeUrl(cfg, facebookRedirectUri(req), state)
  );
  response.cookies.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
