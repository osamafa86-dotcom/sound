import { NextRequest, NextResponse } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { logUsage } from "@/lib/usage";
import { facebookConfig } from "@/lib/facebook/config";
import { publishLink } from "@/lib/facebook/graph";
import { getPageToken } from "@/lib/facebook/pages";
import { newShareId, shareUrl, siteOrigin } from "@/lib/share";

/** نداء واحد إلى فيسبوك بعد تجهيز الرابط */
export const maxDuration = 60;

const MAX_MESSAGE = 5000;

/**
 * نشر عمل من المكتبة على صفحة فيسبوك مربوطة.
 *
 * النشر يستلزم أن يكون العمل مُشاركاً برابط عام — فالمنشور رابط لا ملف
 * (Graph API لا ينشر صوتاً خاماً). لذا نفعّل المشاركة هنا صراحةً ونُعلم
 * المستخدم بذلك في الواجهة قبل الضغط.
 */
export async function POST(req: NextRequest) {
  const cfg = facebookConfig();
  if (!cfg || !supabaseConfigured()) {
    return NextResponse.json(
      { error: "النشر على فيسبوك غير مفعّل على هذا الخادم" },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول أولاً" }, { status: 401 });

  const verdict = await checkLimit(req, "facebook", user.id);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const generationId: string = typeof body?.generationId === "string" ? body.generationId : "";
  const pageId: string = typeof body?.pageId === "string" ? body.pageId : "";
  const message: string =
    typeof body?.message === "string" ? body.message.trim().slice(0, MAX_MESSAGE) : "";

  if (!generationId || !pageId) {
    return NextResponse.json({ error: "العمل والصفحة مطلوبان" }, { status: 400 });
  }

  // الملكية من RLS: جلسة المستخدم لا ترى إلا صفوفه
  const { data: row } = await supabase
    .from("generations")
    .select("id, title, share_id")
    .eq("id", generationId)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "العمل غير موجود" }, { status: 404 });

  const shareId = (row.share_id as string | null) ?? newShareId();
  const { error: shareError } = await supabase
    .from("generations")
    .update({ share_id: shareId, is_public: true })
    .eq("id", generationId);
  if (shareError) {
    return NextResponse.json({ error: "تعذّر تجهيز رابط المشاركة" }, { status: 500 });
  }

  const pageToken = await getPageToken(user.id, pageId, cfg.tokenSecret);
  if (!pageToken) {
    return NextResponse.json(
      { error: "هذه الصفحة غير مربوطة بحسابك — أعد الربط من مكتبتك" },
      { status: 404 }
    );
  }

  const link = shareUrl(shareId, siteOrigin(req));
  const text = message || `${row.title ?? "عمل صوتي"} — صُنع بالذكاء الاصطناعي على مقام`;

  try {
    const post = await publishLink(cfg, pageId, pageToken, text, link);
    await logUsage("facebook", user.id).catch(() => {});
    return NextResponse.json({ ...post, link });
  } catch (e) {
    const detail = e instanceof Error ? e.message : "تعذّر النشر";
    console.error("facebook publish failed:", detail);
    return NextResponse.json({ error: detail }, { status: 502 });
  }
}
