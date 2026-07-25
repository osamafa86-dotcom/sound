import { NextResponse } from "next/server";
import { availableVoices } from "@/lib/providers";

/** كتالوج أصوات المنصة المتاحة فعلياً حسب المفاتيح المضبوطة (ElevenLabs / Azure) */
export async function GET() {
  return NextResponse.json({ voices: availableVoices() });
}
