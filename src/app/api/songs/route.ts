import { NextRequest, NextResponse } from "next/server";
import { MAQAMAT, INSTRUMENTS, SONG_STYLES } from "@/lib/maqamat";
import { getMusicProvider, mockMusic } from "@/lib/providers";
import type { AudioResult, MusicRequest } from "@/lib/providers/types";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const maqam = MAQAMAT.find((m) => m.id === body?.maqamId);
  const style = SONG_STYLES.find((s) => s.id === body?.styleId);

  if (!maqam || !style) {
    return NextResponse.json({ error: "المقام والأسلوب مطلوبان" }, { status: 400 });
  }

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

  const request: MusicRequest = {
    lyrics: body.lyrics,
    maqamId: maqam.id,
    styleId: style.id,
    instrumentIds,
    stylePrompt,
    durationSec: body.durationSec,
  };

  const provider = getMusicProvider();
  let result: AudioResult;
  let fallbackReason = "";

  try {
    result = await provider.generate(request);
  } catch (e) {
    // المحرك الحقيقي غير متاح (شبكة/باقة/إعداد) — نرجع لمعاينة سلّم المقام
    if (provider.id === "mock") throw e;
    fallbackReason = e instanceof Error ? e.message : "unknown";
    console.error("Music provider failed, falling back to mock:", fallbackReason);
    result = await mockMusic.generate(request);
  }

  // سبب الرجوع قد يأتي من داخل سلسلة المزوّدين (Lyria ← Eleven Music) أو من الفشل الكامل
  const reason = fallbackReason || result.fallbackReason || "";

  return new NextResponse(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": result.mimeType,
      "X-Provider": result.provider,
      "X-Mock": result.mock ? "1" : "0",
      "X-Style-Prompt": encodeURIComponent(stylePrompt),
      ...(reason && { "X-Fallback": encodeURIComponent(reason.slice(0, 200)) }),
      ...(result.fallbackFrom && { "X-Fallback-From": result.fallbackFrom }),
    },
  });
}
