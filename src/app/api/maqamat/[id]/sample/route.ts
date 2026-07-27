import { NextRequest, NextResponse } from "next/server";
import { MAQAMAT } from "@/lib/maqamat";
import { synthesizeMaqamScale } from "@/lib/mockAudio";
import { rangeResponse } from "@/lib/httpRange";

/**
 * عينة مسموعة لسلّم المقام بأرباع نغماته — «اختر بأذنك لا بالوصف».
 * تُبنى فورياً على الخادم (بلا محركات مدفوعة) وتُخزَّن لدى المتصفح والـ CDN طويلاً،
 * مع دعم طلبات المدى الذي يشترطه سفاري لتشغيل الوسائط.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const maqam = MAQAMAT.find((m) => m.id === id);
  if (!maqam) {
    return NextResponse.json({ error: "مقام غير معروف" }, { status: 404 });
  }

  const wav = synthesizeMaqamScale(maqam.scale);
  return rangeResponse(req, wav, "audio/wav", {
    "Cache-Control": "public, max-age=31536000, immutable",
  });
}
