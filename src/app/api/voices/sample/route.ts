import { NextRequest, NextResponse } from "next/server";
import { VOICES } from "@/lib/voices";
import { getTTSProvider } from "@/lib/providers";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkLimit, limitResponse } from "@/lib/rateLimit";

export const maxDuration = 60;

/**
 * عينات معرض الأصوات — تُولَّد مرة واحدة لكل صوت وتُخزَّن للأبد.
 *
 * أول استماع لصوتٍ ما يولّد العينة (كلفة مزوّد واحدة تدفعها المنصة)،
 * وكل استماع بعده — من أي زائر — يُقدَّم من التخزين مجاناً وفوراً.
 * لا خصم نقاط على المستخدمين إطلاقاً: العينة واجهة عرض لا استهلاك.
 */

/** الجملة مشكّلة بالكامل وتُؤدَّى بالمحرك التعبيري — الصوت في أبهى حالاته */
const SAMPLE_TEXT =
  "أَهْلًا بِكُمْ فِي مَقَام! اِسْتَمِعُوا إِلَى صَوْتِي، وَأَنَا أُحَوِّلُ كَلِمَاتِكُمْ إِلَى أَدَاءٍ حَيٍّ نَابِضٍ بِالْمَشَاعِرِ.";

const BUCKET = "audio";
const samplePath = (voiceId: string) => `samples/${voiceId}.mp3`;

export async function GET(req: NextRequest) {
  const voiceId = req.nextUrl.searchParams.get("voice") ?? "";
  if (!VOICES.some((v) => v.id === voiceId)) {
    return NextResponse.json({ error: "صوت غير معروف" }, { status: 404 });
  }

  // المخزنة سابقاً تُقدَّم مباشرة — الطريق الساخن بلا أي حدود أو كلفة
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data } = await admin.storage.from(BUCKET).download(samplePath(voiceId));
    if (data) {
      return new NextResponse(data, {
        headers: {
          "Content-Type": "audio/mpeg",
          "Cache-Control": "public, max-age=86400, s-maxage=604800",
          "X-Sample-Cache": "hit",
        },
      });
    }
  }

  // توليد أول مرة فقط — حد متواضع يمنع إغراق المحرك ولا يمس نقاط أحد
  const verdict = await checkLimit(req, "sample");
  if (!verdict.allowed) return limitResponse(verdict);

  try {
    const provider = getTTSProvider(voiceId);
    const result = await provider.synthesize({ text: SAMPLE_TEXT, voiceId, expressive: true });

    if (admin && !result.mock) {
      await admin.storage
        .from(BUCKET)
        .upload(samplePath(voiceId), new Uint8Array(result.audio), {
          contentType: "audio/mpeg",
          upsert: true,
        })
        .catch(() => {});
    }

    return new NextResponse(new Uint8Array(result.audio), {
      headers: {
        "Content-Type": result.mimeType,
        "Cache-Control": "public, max-age=86400",
        "X-Sample-Cache": "miss",
        "X-Mock": result.mock ? "1" : "0",
      },
    });
  } catch (e) {
    console.error("Voice sample failed:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "تعذّر توليد العينة — جرّب بعد قليل" }, { status: 502 });
  }
}
