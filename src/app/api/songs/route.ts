import { NextRequest, NextResponse } from "next/server";
import { MAQAMAT, INSTRUMENTS, SONG_STYLES } from "@/lib/maqamat";
import { createJob, type GenerationTier } from "@/lib/jobs";
import { runSongJob } from "@/lib/songWorker";
import type { MusicRequest } from "@/lib/providers/types";

/** إنشاء مهمة توليد أغنية — يعيد jobId فوراً ويستعلم العميل عن الحالة دورياً */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const maqam = MAQAMAT.find((m) => m.id === body?.maqamId);
  const style = SONG_STYLES.find((s) => s.id === body?.styleId);

  if (!maqam || !style) {
    return NextResponse.json({ error: "المقام والأسلوب مطلوبان" }, { status: 400 });
  }

  const tier: GenerationTier = body.tier === "preview" ? "preview" : "full";
  const instrumentIds: string[] = Array.isArray(body.instrumentIds) ? body.instrumentIds : [];
  const instruments = INSTRUMENTS.filter((i) => instrumentIds.includes(i.id));

  // بناء البرومبت الموسيقي — برومبت Claude الاحترافي (من مساعد الكلمات) إن توفر،
  // وإلا تركيب محلي من بيانات المقام والأسلوب
  const aiStylePrompt = typeof body.aiStylePrompt === "string" ? body.aiStylePrompt.trim().slice(0, 700) : "";
  const stylePrompt = [
    ...(aiStylePrompt ? [aiStylePrompt] : [maqam.stylePrompt, style.en]),
    instruments.map((i) => i.en).join(", "),
    "high quality studio production",
  ]
    .filter(Boolean)
    .join(", ");

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

  const job = createJob(tier, request);
  // تنفيذ في الخلفية دون انتظار — العميل يتابع عبر GET /api/songs/{jobId}
  void runSongJob(job.id);

  return NextResponse.json({ jobId: job.id, stylePrompt }, { status: 202 });
}
