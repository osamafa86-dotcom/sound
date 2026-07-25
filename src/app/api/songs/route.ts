import { NextRequest, NextResponse } from "next/server";
import { MAQAMAT, INSTRUMENTS, SONG_STYLES } from "@/lib/maqamat";
import { getMusicProvider } from "@/lib/providers/mock";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const maqam = MAQAMAT.find((m) => m.id === body?.maqamId);
  const style = SONG_STYLES.find((s) => s.id === body?.styleId);

  if (!maqam || !style) {
    return NextResponse.json({ error: "المقام والأسلوب مطلوبان" }, { status: 400 });
  }

  const instrumentIds: string[] = Array.isArray(body.instrumentIds) ? body.instrumentIds : [];
  const instruments = INSTRUMENTS.filter((i) => instrumentIds.includes(i.id));

  // بناء البرومبت الموسيقي — لاحقاً تتولاه طبقة Claude بصياغة أغنى وأدق
  const stylePrompt = [
    maqam.stylePrompt,
    style.en,
    instruments.map((i) => i.en).join(", "),
    "high quality studio production",
  ]
    .filter(Boolean)
    .join(", ");

  const provider = getMusicProvider();
  const result = await provider.generate({
    lyrics: body.lyrics,
    maqamId: maqam.id,
    styleId: style.id,
    instrumentIds,
    stylePrompt,
  });

  return new NextResponse(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": result.mimeType,
      "X-Provider": result.provider,
      "X-Mock": result.mock ? "1" : "0",
      "X-Style-Prompt": encodeURIComponent(stylePrompt),
    },
  });
}
