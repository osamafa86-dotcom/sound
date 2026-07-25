import { NextRequest, NextResponse } from "next/server";
import { availableVoices } from "@/lib/providers";
import { listCustomVoices } from "@/lib/customVoices";
import { getUserFromRequest } from "@/lib/serverAuth";

/** كتالوج الأصوات المتاحة فعلياً + الأصوات المستنسخة للمستخدم */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const custom = await listCustomVoices(user?.id ?? null);

  return NextResponse.json({
    voices: availableVoices(),
    custom: custom.map((v) => ({
      id: `clone-${v.id}`,
      name: v.name,
      gender: "male",
      dialect: "مستنسخ",
      provider: "elevenlabs",
      tone: "نسختك الرقمية — تقرأ أي نص بصوتك",
      elevenVoiceId: v.id,
    })),
  });
}
