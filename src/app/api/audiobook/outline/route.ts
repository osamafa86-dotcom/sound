import { NextRequest, NextResponse } from "next/server";
import { buildOutline } from "@/lib/audiobook/outline";
import { AUDIOBOOK_LIMITS } from "@/lib/audiobook/types";

/**
 * فهرسة الكتاب — حساب محلي خالص بلا أي استدعاء لمزوّد، فلا كلفة عليه
 * ولا حاجة لسياج حدود؛ يعمل كاملاً حتى بلا أي مفتاح API.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const text: string = typeof body?.text === "string" ? body.text : "";
  const title: string | undefined = typeof body?.title === "string" ? body.title : undefined;

  if (!text.trim()) {
    return NextResponse.json({ error: "نص الكتاب مطلوب" }, { status: 400 });
  }
  if (text.length > AUDIOBOOK_LIMITS.maxInputChars * 2) {
    return NextResponse.json(
      { error: `الحد الأقصى ${AUDIOBOOK_LIMITS.maxInputChars} حرف للكتاب الواحد` },
      { status: 413 }
    );
  }

  return NextResponse.json(buildOutline(text, title));
}
