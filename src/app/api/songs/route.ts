import { NextRequest, NextResponse, after } from "next/server";
import { MAQAMAT, INSTRUMENTS, SONG_STYLES } from "@/lib/maqamat";
import { getJobsStore, type GenerationTier } from "@/lib/jobs";
import { runSongJob } from "@/lib/songWorker";
import { buildStylePrompt } from "@/lib/stylePrompt";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import type { MusicRequest } from "@/lib/providers/types";

/** توليد الأغنية قد يطول — نمنح الدالة مهلة كاملة على Vercel (يشمل التنفيذ الخلفي) */
export const maxDuration = 300;

/** إنشاء مهمة توليد أغنية — يعيد jobId فوراً ويستعلم العميل عن الحالة دورياً */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "songs", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const maqam = MAQAMAT.find((m) => m.id === body?.maqamId);
  const style = SONG_STYLES.find((s) => s.id === body?.styleId);

  if (!maqam || !style) {
    return NextResponse.json({ error: "المقام والأسلوب مطلوبان" }, { status: 400 });
  }

  const tier: GenerationTier = body.tier === "preview" ? "preview" : "full";
  const instrumentIds: string[] = Array.isArray(body.instrumentIds) ? body.instrumentIds : [];
  const instruments = INSTRUMENTS.filter((i) => instrumentIds.includes(i.id));

  // «نسخة أخرى»: رقم النسخة يوجّه المحرك للتنويع بدل إعادة إنتاج التوزيع نفسه
  const variation =
    Number.isInteger(body.variation) && body.variation > 0 ? Math.min(9, body.variation) : 0;

  const stylePrompt = buildStylePrompt({
    maqam,
    styleEn: style.en,
    instrumentsEn: instruments.map((i) => i.en),
    aiStylePrompt: typeof body.aiStylePrompt === "string" ? body.aiStylePrompt : undefined,
    variation,
  });

  // المعاينة دائماً ~30 ثانية؛ الأغنية الكاملة بين 30 و180 ثانية
  const requestedSec = Number.isFinite(body.durationSec) ? Number(body.durationSec) : 60;
  const durationSec = tier === "preview" ? 30 : Math.min(180, Math.max(30, requestedSec));

  const request: MusicRequest = {
    lyrics: typeof body.lyrics === "string" ? body.lyrics.slice(0, 3000) : undefined,
    maqamId: maqam.id,
    styleId: style.id,
    instrumentIds,
    stylePrompt,
    durationSec,
  };

  const job = await getJobsStore().create(tier, request, user?.id ?? null);
  // التنفيذ بعد إرسال الاستجابة — after() تضمن إكمال العمل على Vercel Serverless
  after(() => runSongJob(job.id));

  return NextResponse.json({ jobId: job.id, stylePrompt }, { status: 202 });
}
