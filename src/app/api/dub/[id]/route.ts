import { NextRequest, NextResponse } from "next/server";
import { elevenLabsDubStatus, humanizeElevenLabsError } from "@/lib/providers/elevenlabs";
import { MEMBER_ONLY_MESSAGE } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 30;

const ID_RE = /^[A-Za-z0-9_-]{6,128}$/;

/**
 * حالة مشروع الدبلجة — يستطلعها العميل كل بضع ثوانٍ. بوابة عضوية بلا
 * استهلاك من حدود الطلبات: الاستطلاع الدوري ليس توليداً جديداً.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user && getSupabaseAdmin() && process.env.ALLOW_VISITOR_GENERATION !== "1") {
    return NextResponse.json({ error: MEMBER_ONLY_MESSAGE }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "معرّف مشروع غير صالح" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "الدبلجة غير مهيأة في هذه البيئة" }, { status: 503 });
  }

  try {
    const status = await elevenLabsDubStatus(apiKey, id);
    return NextResponse.json(status);
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر جلب الحالة";
    const notFound = /dubbing_not_found|ElevenLabs 404/.test(message);
    if (!notFound) console.error("Dubbing status failed:", message);
    return NextResponse.json(
      { error: notFound ? "المشروع غير موجود أو انتهت صلاحيته" : humanizeElevenLabsError(message) },
      { status: notFound ? 404 : 502 }
    );
  }
}
