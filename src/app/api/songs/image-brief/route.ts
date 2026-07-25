import { NextRequest, NextResponse } from "next/server";
import { imageToMusicBrief } from "@/lib/imageBrief";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

/** تحليل الرؤية قد يستغرق وقتاً على الصور الكبيرة */
export const maxDuration = 60;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

/** من صورة إلى موجز موسيقي: مقام + وصف + برومبت لمحرك التوليد */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "تحليل الصور يتطلب ربط مفتاح Gemini API" },
      { status: 503 }
    );
  }

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "imageBrief", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "أرفق صورة أولاً" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "الصيغ المدعومة: JPEG أو PNG أو WebP" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "الحد الأقصى لحجم الصورة 8 ميغابايت" }, { status: 400 });
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const brief = await imageToMusicBrief(apiKey, base64, file.type);
    await logUsage("imageBrief", user?.id ?? null);
    return NextResponse.json(brief);
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر تحليل الصورة";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
