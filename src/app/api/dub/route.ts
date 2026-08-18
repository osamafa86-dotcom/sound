import { NextRequest, NextResponse } from "next/server";
import {
  elevenLabsDubStart,
  humanizeElevenLabsError,
} from "@/lib/providers/elevenlabs";
import { DUB_MAX_BYTES, isDubSource, isDubTarget } from "@/lib/dubbing";
import { refundCredits } from "@/lib/credits";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;

/**
 * 🌍 بدء دبلجة: يستلم ملفاً صوتياً أو فيديو ولغة هدف، يرفعه إلى محرك
 * الدبلجة ويعيد معرّف المشروع فوراً — المتابعة عبر GET /api/dub/[id]
 * ثم التنزيل من /api/dub/[id]/audio عند الاكتمال.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "dub", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const refund = () => user && refundCredits(user.id, "dub").catch(() => {});

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    await refund();
    return NextResponse.json({ error: "أرفق ملفاً صوتياً أو فيديو أولاً" }, { status: 400 });
  }
  if (file.size > DUB_MAX_BYTES) {
    await refund();
    return NextResponse.json({ error: "الحد الأقصى لحجم الملف 25 ميغابايت" }, { status: 400 });
  }

  const targetLang = String(form?.get("targetLang") ?? "");
  const sourceLang = String(form?.get("sourceLang") ?? "auto");
  if (!isDubTarget(targetLang) || !isDubSource(sourceLang)) {
    await refund();
    return NextResponse.json({ error: "لغة غير مدعومة" }, { status: 400 });
  }
  if (sourceLang === targetLang) {
    await refund();
    return NextResponse.json({ error: "لغة الهدف يجب أن تختلف عن لغة المصدر" }, { status: 400 });
  }

  const numSpeakers = Math.min(5, Math.max(0, Number(form?.get("numSpeakers") ?? 0) || 0));
  const dropBackground = form?.get("dropBackground") === "1";
  const fileName =
    file instanceof File && file.name ? file.name.slice(0, 120) : "source-audio";

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    await refund();
    return NextResponse.json(
      { error: "الدبلجة تتطلب مفتاح ElevenLabs — غير مضبوط في هذه البيئة" },
      { status: 503 }
    );
  }

  try {
    const job = await elevenLabsDubStart(apiKey, {
      file,
      fileName,
      targetLang,
      sourceLang,
      numSpeakers,
      dropBackground,
      name: `مقام — ${fileName}`,
    });
    await logUsage("dub", user?.id ?? null);
    return NextResponse.json({ id: job.dubbingId, expectedSec: job.expectedSec ?? null });
  } catch (e) {
    await refund();
    const message = e instanceof Error ? e.message : "تعذّر بدء الدبلجة";
    console.error("Dubbing start failed:", message);
    return NextResponse.json({ error: humanizeElevenLabsError(message) }, { status: 502 });
  }
}
