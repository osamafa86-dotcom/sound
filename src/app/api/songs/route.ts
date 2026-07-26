import { NextRequest, NextResponse, after } from "next/server";
import { DIALECTS, MAQAMAT, INSTRUMENTS, SONG_STYLES } from "@/lib/maqamat";
import { applyPronunciationRules, listRules } from "@/lib/pronunciation";
import { getJobsStore, type GenerationTier } from "@/lib/jobs";
import { runSongJob } from "@/lib/songWorker";
import { buildStylePrompt } from "@/lib/stylePrompt";
import { heritageDeliveryEn, heritageStyle } from "@/lib/heritage/palestinian";
import { pickMaqamPrompt } from "@/lib/promptVariants";
import { SECTION_MIN_SEC, sanitizeSections, sectionsTotalSec } from "@/lib/songSections";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import type { MusicRequest } from "@/lib/providers/types";

/** توليد الأغنية قد يطول — نمنح الدالة مهلة كاملة على Vercel (يشمل التنفيذ الخلفي) */
export const maxDuration = 300;

/** سجل «توليداتي» — آخر مهام المستخدم ليستعيد ما ولّده حتى بعد إغلاق الصفحة */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ jobs: [] });

  const jobs = await getJobsStore().listRecent(user.id, 10);
  return NextResponse.json({
    jobs: jobs.map((j) => ({
      id: j.id,
      status: j.status,
      stage: j.stage,
      tier: j.tier,
      maqamId: j.request.maqamId,
      styleId: j.request.styleId,
      durationSec: j.request.durationSec,
      provider: j.provider,
      mock: j.mock,
      createdAt: j.createdAt,
    })),
  });
}

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

  // سلالة برومبت المقام من العقل — تُستخدم فقط حين لا يوجد برومبت مساعد يحل محلها
  const aiStylePrompt = typeof body.aiStylePrompt === "string" ? body.aiStylePrompt : undefined;
  const picked = aiStylePrompt ? null : await pickMaqamPrompt(maqam.id);

  const baseStylePrompt = buildStylePrompt({
    maqam: picked?.prompt ? { ...maqam, stylePrompt: picked.prompt } : maqam,
    styleEn: style.en,
    instrumentsEn: instruments.map((i) => i.en),
    aiStylePrompt,
    variation,
  });

  // ذاكرة التراث: الحمض الموسيقي للقالب الفلسطيني + توجيه الأداء باللهجة
  const heritage = heritageStyle(style.id);
  const heritageDelivery = heritageDeliveryEn(
    typeof body.dialectId === "string" ? body.dialectId : undefined,
    style.id
  );
  const stylePrompt = [baseStylePrompt, heritage?.dna, heritageDelivery]
    .filter(Boolean)
    .join(". ");

  // المقاطع المُهيكلة (النسخة الكاملة فقط) — المعاينة تبقى مقطعاً سريعاً واحداً
  let sections = tier === "full" ? sanitizeSections(body.sections) : undefined;
  const MAX_TOTAL_SEC = 300;
  if (sections) {
    const total = sectionsTotalSec(sections);
    // تجاوز سقف المنصة: تقليص المدد نسبياً بدل الرفض
    if (total > MAX_TOTAL_SEC) {
      const factor = MAX_TOTAL_SEC / total;
      sections = sections.map((s) => ({
        ...s,
        durationSec: Math.max(SECTION_MIN_SEC, Math.round(s.durationSec * factor)),
      }));
    }
  }

  const singer = body.singer === "male" || body.singer === "female" ? body.singer : undefined;
  const bpm = Number.isFinite(body.bpm)
    ? Math.min(200, Math.max(40, Math.round(Number(body.bpm))))
    : undefined;

  // إعادة توليد مقطع بعينه: تتطلب المقاطع ومعرّف الأغنية الأصلية لدى المحرك
  const regenerateIndex =
    sections &&
    Number.isInteger(body.regenerateSectionIndex) &&
    body.regenerateSectionIndex >= 0 &&
    body.regenerateSectionIndex < sections.length
      ? (body.regenerateSectionIndex as number)
      : undefined;
  const sourceSongId =
    regenerateIndex !== undefined &&
    typeof body.sourceSongId === "string" &&
    /^[A-Za-z0-9_-]{6,128}$/.test(body.sourceSongId)
      ? (body.sourceSongId as string)
      : undefined;

  // المعاينة دائماً ~30 ثانية؛ الأغنية الكاملة بين 30 و180 ثانية أو مجموع مقاطعها
  const requestedSec = Number.isFinite(body.durationSec) ? Number(body.durationSec) : 60;
  const durationSec =
    tier === "preview"
      ? 30
      : sections
        ? sectionsTotalSec(sections)
        : Math.min(180, Math.max(30, requestedSec));

  // ذاكرة النطق تُطبَّق نصياً على كلمات الغناء — كل كلمة علّمها المستخدمون
  // للعقل تُغنى بصيغتها الصحيحة في كل أغنية قادمة تلقائياً
  let lyrics = typeof body.lyrics === "string" ? body.lyrics.slice(0, 3000) : undefined;
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (elevenKey && (lyrics || sections)) {
    const rules = await listRules(elevenKey).catch(() => []);
    if (rules.length) {
      if (lyrics) lyrics = applyPronunciationRules(lyrics, rules);
      if (sections) {
        sections = sections.map((s) => ({ ...s, lyrics: applyPronunciationRules(s.lyrics, rules) }));
      }
    }
  }

  // لهجة الأداء الغنائي — توجّه المحرك لنطق أصيل باللهجة المختارة
  const deliveryDialect = DIALECTS.find((d) => d.id === body.dialectId);

  const request: MusicRequest = {
    lyrics,
    maqamId: maqam.id,
    styleId: style.id,
    instrumentIds,
    stylePrompt,
    durationSec,
    sections,
    singer,
    bpm,
    dialectEn: deliveryDialect?.en,
    ...(picked?.variantId && { variantId: picked.variantId }),
    ...(sourceSongId && { regenerateIndex, sourceSongId }),
  };

  const job = await getJobsStore().create(tier, request, user?.id ?? null);
  // التنفيذ بعد إرسال الاستجابة — after() تضمن إكمال العمل على Vercel Serverless
  after(() => runSongJob(job.id));

  return NextResponse.json({ jobId: job.id, stylePrompt }, { status: 202 });
}
