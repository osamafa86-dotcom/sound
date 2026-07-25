import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * التقييمات — وقود «عقل» المنصة.
 * كل نجمة يعطيها مستخدم تُغذّي ترتيب الأصوات والضبط الذاتي للإعدادات.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "سجّل الدخول للتقييم" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const generationId: string = body?.generationId ?? "";
  const score = Number(body?.score);

  if (!generationId || !Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: "التقييم يجب أن يكون من 1 إلى 5" }, { status: 400 });
  }

  const { error } = await supabase.from("ratings").upsert(
    {
      generation_id: generationId,
      user_id: user.id,
      score,
      note: typeof body?.note === "string" ? body.note.slice(0, 500) : null,
    },
    { onConflict: "generation_id,user_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** ترتيب الأصوات حسب متوسط التقييم — يُستخدم لترتيب الكتالوج */
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("voice_scores")
    .select("voice_id, ratings_count, avg_score")
    .order("avg_score", { ascending: false });

  if (error) return NextResponse.json({ scores: [] });
  return NextResponse.json({ scores: data ?? [] });
}
