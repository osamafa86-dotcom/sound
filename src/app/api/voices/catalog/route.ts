import { NextResponse } from "next/server";
import { availableVoices } from "@/lib/providers";
import { getVoiceScores, getVoiceTuning } from "@/lib/brain";

/** الكتالوج يقرأ تقييمات حيّة من القاعدة — لا يُخزَّن وقت البناء */
export const dynamic = "force-dynamic";

/**
 * كتالوج أصوات المنصة المتاحة فعلياً حسب المفاتيح المضبوطة (ElevenLabs / Azure)،
 * مُثرى بإشارات عقل المنصة: تقييم كل صوت وإعداداته المتعلمة،
 * مع ترتيب الأصوات داخل كل لهجة بالأعلى رضاً أولاً.
 */
export async function GET() {
  const [scores, tuning] = await Promise.all([getVoiceScores(), getVoiceTuning()]);

  const enriched = availableVoices().map((v) => {
    const s = scores.get(v.id);
    const t = tuning.get(v.id);
    return {
      ...v,
      ...(s ? { rating: { avg: s.avg, count: s.count } } : {}),
      ...(t ? { learned: { stability: t.stability, speed: t.speed } } : {}),
    };
  });

  // ترتيب اللهجات المنسّق يبقى كما هو، وداخل كل لهجة يتقدّم الأعلى تقييماً
  // (sort مستقر — الأصوات غير المقيّمة تحافظ على ترتيبها اليدوي)
  const groups = new Map<string, typeof enriched>();
  for (const v of enriched) {
    const group = groups.get(v.dialect) ?? [];
    group.push(v);
    groups.set(v.dialect, group);
  }
  const voices = [...groups.values()].flatMap((group) =>
    [...group].sort(
      (a, b) =>
        (b.rating?.avg ?? -1) - (a.rating?.avg ?? -1) ||
        (b.rating?.count ?? 0) - (a.rating?.count ?? 0)
    )
  );

  return NextResponse.json({ voices });
}
