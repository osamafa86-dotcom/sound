import { NextRequest, NextResponse } from "next/server";
import { elevenLabsDubAudio, humanizeElevenLabsError } from "@/lib/providers/elevenlabs";
import { isDubTarget } from "@/lib/dubbing";
import { MEMBER_ONLY_MESSAGE } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 120;

const ID_RE = /^[A-Za-z0-9_-]{6,128}$/;

/** تنزيل ناتج الدبلجة الجاهز — mp3 لمصدر صوتي وmp4 لمصدر فيديو */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromRequest(req);
  if (!user && getSupabaseAdmin() && process.env.ALLOW_VISITOR_GENERATION !== "1") {
    return NextResponse.json({ error: MEMBER_ONLY_MESSAGE }, { status: 401 });
  }

  const { id } = await ctx.params;
  const lang = req.nextUrl.searchParams.get("lang") ?? "";
  if (!ID_RE.test(id) || !isDubTarget(lang)) {
    return NextResponse.json({ error: "معرّف أو لغة غير صالحة" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "الدبلجة غير مهيأة في هذه البيئة" }, { status: 503 });
  }

  try {
    const result = await elevenLabsDubAudio(apiKey, id, lang);
    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "private, max-age=3600",
        "X-Mock": "0",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر تنزيل الناتج";
    console.error("Dubbing download failed:", message);
    return NextResponse.json({ error: humanizeElevenLabsError(message) }, { status: 502 });
  }
}
