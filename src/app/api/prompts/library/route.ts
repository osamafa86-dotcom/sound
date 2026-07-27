import { NextRequest, NextResponse } from "next/server";
import { listPromptCrafts, savePromptCraft, setPromptFeedback } from "@/lib/promptLibrary";
import { PROMPT_TYPES } from "@/lib/promptSmith";
import { getUserFromRequest } from "@/lib/serverAuth";
import type { CraftedPrompt } from "@/lib/promptSmith";

/** مكتبة برومبتات المستخدم: قائمة، حفظ، وتقييم يغذي أمثلة العقل */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ crafts: [] });
  return NextResponse.json({ crafts: await listPromptCrafts(user.id) });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ id: null });

  const body = await req.json().catch(() => null);
  const typeId = typeof body?.typeId === "string" ? body.typeId : "";
  if (!PROMPT_TYPES.some((t) => t.id === typeId)) {
    return NextResponse.json({ error: "نوع غير معروف" }, { status: 400 });
  }
  const result = body?.result as CraftedPrompt;
  const brief = typeof body?.brief === "string" ? body.brief : "";
  if (!result?.prompt || !brief) {
    return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
  }

  const id = await savePromptCraft({
    userId: user.id,
    typeId,
    platform: typeof body?.platform === "string" ? body.platform : undefined,
    brief,
    result,
    score: Number.isFinite(body?.score) ? Math.round(body.score) : undefined,
  });
  return NextResponse.json({ id });
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "سجّل الدخول أولاً" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  const feedback = body?.feedback === 1 ? 1 : body?.feedback === -1 ? -1 : null;
  if (!id || !feedback) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });

  const ok = await setPromptFeedback(user.id, id, feedback);
  return NextResponse.json({ ok });
}
