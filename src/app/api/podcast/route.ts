import { NextRequest, NextResponse } from "next/server";
import {
  generatePodcast,
  PODCAST_LIMITS,
  type PodcastLength,
  type PodcastTone,
} from "@/lib/podcast/script";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

/** إعداد حلقة كاملة يستغرق وقتاً */
export const maxDuration = 180;

const LENGTHS: PodcastLength[] = ["short", "medium", "long"];
const TONES: PodcastTone[] = ["informative", "casual", "debate", "storytelling"];

/** موضوع واحد ← سيناريو حلقة حوارية جاهز لمحرك الإنتاج الدرامي */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "drama", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "البودكاست الذكي يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const topic: string = typeof body?.topic === "string" ? body.topic.trim() : "";
  const length: PodcastLength = LENGTHS.includes(body?.length) ? body.length : "medium";
  const tone: PodcastTone = TONES.includes(body?.tone) ? body.tone : "informative";
  const dialect: string = typeof body?.dialect === "string" && body.dialect ? body.dialect : "الفصحى";

  if (!topic) return NextResponse.json({ error: "موضوع الحلقة مطلوب" }, { status: 400 });
  if (topic.length > PODCAST_LIMITS.maxTopicChars) {
    return NextResponse.json(
      { error: `الحد الأقصى لوصف الموضوع ${PODCAST_LIMITS.maxTopicChars} حرف` },
      { status: 400 }
    );
  }

  try {
    const script = await generatePodcast(key, topic, length, tone, dialect);
    await logUsage("podcast", user?.id ?? null).catch(() => {});
    return NextResponse.json(script);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر إعداد الحلقة";
    return NextResponse.json(
      { error: msg.startsWith("Gemini") ? "تعذّر إعداد الحلقة — حاول مجدداً" : msg },
      { status: 502 }
    );
  }
}
