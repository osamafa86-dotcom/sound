import { NextRequest, NextResponse } from "next/server";
import { getTTSProvider } from "@/lib/providers/mock";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text: string = body?.text?.trim();

  if (!text) {
    return NextResponse.json({ error: "النص مطلوب" }, { status: 400 });
  }
  if (text.length > 5000) {
    return NextResponse.json({ error: "الحد الأقصى 5000 حرف" }, { status: 400 });
  }

  const provider = getTTSProvider();
  const result = await provider.synthesize({
    text,
    voiceId: body.voiceId ?? "",
    stability: body.stability,
    speed: body.speed,
    format: body.format,
  });

  return new NextResponse(new Uint8Array(result.audio), {
    headers: {
      "Content-Type": result.mimeType,
      "X-Provider": result.provider,
      "X-Mock": result.mock ? "1" : "0",
    },
  });
}
