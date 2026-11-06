import { NextRequest, NextResponse } from "next/server";
import { needsTashkeel, proofreadLyrics } from "@/lib/lyricsProofread";
import { parseSections, sanitizeSections } from "@/lib/songSections";
import { SUNO_EXCLUDE, sunoLyrics, sunoStyle, sunoTitle, type SunoPackage } from "@/lib/sunoPackage";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 120;

/**
 * حزمة Suno: كلمات مشكّلة تشكيلاً تاماً حسب اللهجة بعلامات المقاطع،
 * وبرومبت أسلوب للمقام واللهجة والآلات، وعنوان — جاهزة للصق في وضع Custom.
 * التشكيل أعلى رافعة لسلامة النطق المغنّى في أي محرك، وSuno ليس استثناءً.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "enhance", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  let sections = sanitizeSections(body?.sections);
  if (!sections) {
    const lyrics = typeof body?.lyrics === "string" ? body.lyrics.trim().slice(0, 5000) : "";
    if (!lyrics) return NextResponse.json({ error: "أوصل الكلمات أولاً" }, { status: 400 });
    sections = parseSections(lyrics);
  }
  if (!sections.length) {
    return NextResponse.json({ error: "لم أجد كلمات قابلة للأداء" }, { status: 400 });
  }

  const dialectId = typeof body?.dialectId === "string" ? body.dialectId : "";
  let tashkeel: "done" | "kept" | "skipped" = "kept";

  // تشكيل تام فقط لما ينقصه — الكلمات المشكّلة يدوياً تُحترم كما هي
  const sung = sections.map((s) => s.lyrics).join("\n");
  const geminiKey = process.env.GEMINI_API_KEY;
  if (body?.tashkeel !== false && needsTashkeel(sung)) {
    if (geminiKey) {
      try {
        const proofed = await proofreadLyrics(geminiKey, sections, dialectId);
        if (proofed.sections?.length) sections = proofed.sections;
        tashkeel = "done";
        await logUsage("proofread", user?.id ?? null);
      } catch (e) {
        console.warn("suno package tashkeel failed, using raw lyrics:", e);
        tashkeel = "skipped";
      }
    } else {
      tashkeel = "skipped";
    }
  }

  const pkg: SunoPackage = {
    title: sunoTitle(sections, typeof body?.title === "string" ? body.title : undefined),
    lyrics: sunoLyrics(sections),
    style: sunoStyle({
      maqamId: typeof body?.maqamId === "string" ? body.maqamId : "",
      styleId: typeof body?.styleId === "string" ? body.styleId : "",
      dialectId,
      singer: body?.singer === "male" || body?.singer === "female" ? body.singer : undefined,
      instrumentIds: Array.isArray(body?.instrumentIds)
        ? body.instrumentIds.filter((i: unknown) => typeof i === "string")
        : [],
    }),
    exclude: SUNO_EXCLUDE,
  };

  return NextResponse.json({ ...pkg, tashkeel });
}
