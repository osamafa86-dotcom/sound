import { NextRequest, NextResponse } from "next/server";
import {
  aiImage,
  aiText,
  aiVideo,
  hailuoVideo,
  type AiContext,
  type AiMedia,
} from "@/lib/studio/aiEngine";
import { refundCredits } from "@/lib/credits";
import { checkLimit, limitResponse, type LimitScope } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

/** توليد الفيديو عملية طويلة — المهلة الكاملة على Vercel */
export const maxDuration = 300;

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const SCOPE_BY_MODE: Record<string, LimitScope> = {
  text: "aiText",
  image: "aiImage",
  video: "aiVideo",
};

async function readMedia(form: FormData, field: string): Promise<AiMedia[]> {
  const out: AiMedia[] = [];
  for (const f of form.getAll(field)) {
    if (!(f instanceof Blob) || f.size === 0) continue;
    out.push({
      data: Buffer.from(await f.arrayBuffer()),
      mimeType: f.type || (field === "image" ? "image/png" : field === "video" ? "video/mp4" : "audio/mpeg"),
    });
  }
  return out;
}

/**
 * بطاقة «ذكاء مقام» الشاملة في المساحة — نص أو صورة أو فيديو،
 * بتغذية جمعية: نصوص وأصوات وصور وفيديو من كل البطاقات الموصولة معاً.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });

  const mode = String(form.get("mode") ?? "text");
  const scope = SCOPE_BY_MODE[mode];
  if (!scope) return NextResponse.json({ error: "وضع غير معروف" }, { status: 400 });

  const prompt = String(form.get("prompt") ?? "").trim().slice(0, 4000);
  if (!prompt) return NextResponse.json({ error: "اكتب توجيهاً للذكاء أولاً" }, { status: 400 });

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, scope, user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const apiKey = process.env.GEMINI_API_KEY;
  // الفيديو: Hailuo أولاً (يعمل برصيد MiniMax المشحون) — Veo يتطلب فوترة Google.
  // VIDEO_PROVIDER=veo يعيد Veo قسراً عند تفعيل فوترته لاحقاً.
  const mmKey = process.env.MINIMAX_API_KEY;
  const mmGroup = process.env.MINIMAX_GROUP_ID;
  const useHailuo = mode === "video" && !!mmKey && !!mmGroup && process.env.VIDEO_PROVIDER !== "veo";

  if (!apiKey && !(mode === "video" && useHailuo)) {
    return NextResponse.json(
      { error: "بطاقة الذكاء تتطلب مفتاح Gemini — غير مضبوط في هذه البيئة" },
      { status: 503 }
    );
  }

  // التغذية الجمعية: نصوص كمصفوفة JSON + وسائط كملفات مرفقة
  let texts: string[] = [];
  try {
    const parsed = JSON.parse(String(form.get("texts") ?? "[]"));
    if (Array.isArray(parsed)) {
      texts = parsed
        .filter((t): t is string => typeof t === "string" && !!t.trim())
        .slice(0, 8)
        .map((t) => t.slice(0, 8000));
    }
  } catch {
    /* تغذية نصية غير صالحة تُتجاهل */
  }

  const ctx: AiContext = {
    texts,
    audios: await readMedia(form, "audio"),
    images: await readMedia(form, "image"),
    videos: await readMedia(form, "video"),
  };

  const all = [...ctx.audios, ...ctx.images, ...ctx.videos];
  if (all.some((m) => m.data.length > MAX_FILE_BYTES)) {
    return NextResponse.json({ error: "الحد الأقصى لحجم المادة الواحدة 15 ميغابايت" }, { status: 400 });
  }
  if (all.reduce((s, m) => s + m.data.length, 0) > MAX_TOTAL_BYTES) {
    return NextResponse.json(
      { error: "مجموع المواد الواصلة يتجاوز 20 ميغابايت — قلّل التغذية" },
      { status: 400 }
    );
  }

  try {
    if (mode === "text") {
      const text = await aiText(apiKey!, prompt, ctx);
      await logUsage(scope, user?.id ?? null);
      return NextResponse.json({ text });
    }

    if (mode === "image") {
      const image = await aiImage(apiKey!, prompt, ctx);
      await logUsage(scope, user?.id ?? null);
      return new NextResponse(new Uint8Array(image.data), {
        headers: { "Content-Type": image.mimeType },
      });
    }

    const durationSec = Number(form.get("durationSec"));
    const aspect = String(form.get("aspectRatio") ?? "16:9");
    const videoOpts = {
      durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
      aspectRatio: (aspect === "9:16" ? "9:16" : "16:9") as "16:9" | "9:16",
    };
    const video = useHailuo
      ? await hailuoVideo(mmKey!, mmGroup!, prompt, ctx, videoOpts)
      : await aiVideo(apiKey!, prompt, ctx, videoOpts);
    await logUsage(scope, user?.id ?? null);
    return new NextResponse(new Uint8Array(video.data), {
      headers: { "Content-Type": video.mimeType },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر التوليد";
    console.error(`studio ai (${mode}) failed:`, message);
    // توليد مدفوع فاشل لا يُدفع مقابله
    if (user) await refundCredits(user.id, scope).catch(() => {});
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
