import { NextRequest, NextResponse } from "next/server";
import { MAQAMAT } from "@/lib/maqamat";
import { synthesizeMaqamScale } from "@/lib/mockAudio";

/**
 * عينة مسموعة لسلّم المقام بأرباع نغماته — «اختر بأذنك لا بالوصف».
 * تُبنى فورياً على الخادم (بلا محركات مدفوعة) وتُخزَّن لدى المتصفح والـ CDN طويلاً.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const maqam = MAQAMAT.find((m) => m.id === id);
  if (!maqam) {
    return NextResponse.json({ error: "مقام غير معروف" }, { status: 404 });
  }

  const wav = synthesizeMaqamScale(maqam.scale);
  return new NextResponse(new Uint8Array(wav), {
    headers: {
      "Content-Type": "audio/wav",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
