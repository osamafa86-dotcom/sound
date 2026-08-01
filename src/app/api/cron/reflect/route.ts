import { NextRequest, NextResponse } from "next/server";
import { MAQAMAT } from "@/lib/maqamat";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  MAX_ACTIVE_VARIANTS,
  MIN_EVALS_TO_TRUST,
  signalContribution,
  variantAvg,
  type PromptVariantRow,
} from "@/lib/promptVariants";
import { consumeRateLimit } from "@/lib/rateLimit";

/**
 * جلسة التأمل الأسبوعية — قلب التطور الذاتي:
 * 1. بذر سلالة لكل مقام بلا سلالات (من برومبت الكود)
 * 2. إعادة احتساب درجات السلالات من النقد الذاتي والإشارات
 * 3. للمقامات الناضجة بيانات: توليد سلالة جديدة محسّنة عبر Gemini
 *    وإيقاف الأسوأ عند تجاوز السقف — والبذرة لا تُعطَّل أبداً
 */

export const maxDuration = 180;

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

const NEW_VARIANT_SCHEMA = {
  type: "object",
  properties: {
    prompt: {
      type: "string",
      description:
        "Improved English music-generation prompt for this maqam: jins, quarter tones, rhythms, mood, instruments. Dense, under 400 characters.",
    },
    rationale: { type: "string", description: "سطر عربي: ما الذي حسّنته ولماذا" },
  },
  required: ["prompt", "rationale"],
  propertyOrdering: ["prompt", "rationale"],
};

export async function GET(req: NextRequest) {
  // حماية: سر الجدولة إن ضُبط، وسقف تشغيل يومي في كل الأحوال
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await consumeRateLimit("reflect:global", 3, 24 * 3600))) {
    return NextResponse.json({ error: "تم بلوغ سقف جلسات التأمل اليومي" }, { status: 429 });
  }

  const admin = getSupabaseAdmin();
  if (!admin || process.env.BRAIN_DISABLED === "1") {
    return NextResponse.json({ skipped: true, reason: "العقل معطّل أو المنصة غير مهيأة" });
  }

  const summary = { seeded: 0, rescored: 0, evolved: [] as string[], deactivated: 0 };

  // ١) البذر
  const { data: existing } = await admin.from("prompt_variants").select("*");
  const variants = (existing ?? []) as PromptVariantRow[];
  for (const maqam of MAQAMAT) {
    if (!variants.some((v) => v.maqam_id === maqam.id)) {
      const { error } = await admin.from("prompt_variants").insert({
        maqam_id: maqam.id,
        prompt: maqam.stylePrompt,
        source: "seed",
      });
      if (!error) summary.seeded++;
    }
  }

  // ٢) إعادة احتساب الدرجات: النقد الذاتي (variant_id) + الإشارات (مطابقة البرومبت)
  const [{ data: evals }, { data: sigs }] = await Promise.all([
    admin.from("auto_evals").select("variant_id, score").eq("kind", "song").not("variant_id", "is", null).limit(2000),
    admin
      .from("signals")
      .select("maqam_id, settings, weight")
      .not("maqam_id", "is", null)
      .limit(2000),
  ]);

  const { data: fresh } = await admin.from("prompt_variants").select("*");
  for (const v of (fresh ?? []) as PromptVariantRow[]) {
    const contributions: number[] = [];
    for (const e of evals ?? []) {
      if (e.variant_id === v.id) contributions.push(Number(e.score));
    }
    // الإشارة تُنسب للسلالة التي يبدأ برومبت توليدتها ببرومبتها
    const head = v.prompt.slice(0, 80);
    for (const s of sigs ?? []) {
      const settings = s.settings as Record<string, unknown> | null;
      // إشارات وضع المقارنة (تحمل engine) حكم بين محركين لا بين سلالات
      // برومبت — النسختان تتشاركان البرومبت نفسه فتسمم فوزاً وخسارة معاً
      if (settings?.engine) continue;
      const sp = settings?.stylePrompt;
      if (s.maqam_id === v.maqam_id && typeof sp === "string" && sp.startsWith(head)) {
        contributions.push(signalContribution(Number(s.weight)));
      }
    }
    if (contributions.length) {
      const sum = contributions.reduce((a, b) => a + b, 0);
      await admin
        .from("prompt_variants")
        .update({ score_sum: sum, score_count: contributions.length })
        .eq("id", v.id);
      summary.rescored++;
    }
  }

  // ٣) التطور: مقامات نضجت أدلتها تلد سلالة محسّنة
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const { data: current } = await admin.from("prompt_variants").select("*");
    const all = (current ?? []) as PromptVariantRow[];

    for (const maqam of MAQAMAT) {
      const mine = all.filter((v) => v.maqam_id === maqam.id && v.active);
      const evidence = mine.reduce((s, v) => s + v.score_count, 0);
      if (evidence < 6 || mine.length >= MAX_ACTIVE_VARIANTS) continue;

      const ranked = [...mine].sort((a, b) => variantAvg(b) - variantAvg(a));
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];

      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: `أنت خبير برومبتات توليد الموسيقى العربية. لمقام ${maqam.name} («${maqam.mood}»):

أفضل برومبت حالياً (درجة ${variantAvg(best).toFixed(2)} من ${best.score_count} دليلاً):
"""${best.prompt}"""
${worst.id !== best.id ? `\nأضعف برومبت (درجة ${variantAvg(worst).toFixed(2)}):\n"""${worst.prompt}"""\n` : ""}
اكتب نسخة محسّنة تبني على نقاط قوة الأفضل وتتجنب ضعف الأضعف: أدق في الجنس المقامي وأرباع النغمات والإيقاعات المميزة، مع لمسة تميّز جديدة. بالإنجليزية وبأقل من 400 حرف.`,
                    },
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: "application/json",
                responseSchema: NEW_VARIANT_SCHEMA,
                temperature: 0.8,
                maxOutputTokens: 1024,
              },
            }),
          }
        );
        if (!res.ok) continue;
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) continue;
        const proposal = JSON.parse(text) as { prompt: string; rationale: string };
        if (!proposal.prompt || proposal.prompt.length < 40) continue;

        await admin.from("prompt_variants").insert({
          maqam_id: maqam.id,
          prompt: proposal.prompt.slice(0, 500),
          source: "reflection",
        });
        summary.evolved.push(maqam.id);
      } catch (e) {
        console.error("reflect evolve failed:", maqam.id, e instanceof Error ? e.message : e);
      }
    }

    // ضبط السقف: أسوأ السلالات الناضجة غير البذرية تُعطَّل عند التزاحم
    const { data: after } = await admin.from("prompt_variants").select("*");
    const grouped = new Map<string, PromptVariantRow[]>();
    for (const v of (after ?? []) as PromptVariantRow[]) {
      if (!v.active) continue;
      const g = grouped.get(v.maqam_id) ?? [];
      g.push(v);
      grouped.set(v.maqam_id, g);
    }
    for (const [, group] of grouped) {
      if (group.length <= MAX_ACTIVE_VARIANTS) continue;
      const removable = group
        .filter((v) => v.source !== "seed" && v.score_count >= MIN_EVALS_TO_TRUST)
        .sort((a, b) => variantAvg(a) - variantAvg(b));
      const excess = group.length - MAX_ACTIVE_VARIANTS;
      for (const v of removable.slice(0, excess)) {
        await admin.from("prompt_variants").update({ active: false }).eq("id", v.id);
        summary.deactivated++;
      }
    }
  }

  return NextResponse.json(summary);
}
