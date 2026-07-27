import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";

const TOPICS = ["مشكلة تقنية", "ترقية الباقة", "اقتراح ميزة", "استفسار آخر"];

/** إرسال تذكرة دعم — متاح للجميع، والمسجل تُربط تذكرته بحسابه */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "support", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().slice(0, 200) : "";
  const topic = TOPICS.includes(body?.topic) ? body.topic : TOPICS[3];
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 4000) : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return NextResponse.json({ error: "اكتب بريداً إلكترونياً صحيحاً لنرد عليك" }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json({ error: "اشرح طلبك بجملة واحدة على الأقل" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: "نظام الدعم غير مهيأ في هذه البيئة" }, { status: 503 });
  }

  const { error } = await admin.from("support_tickets").insert({
    user_id: user?.id ?? null,
    email,
    topic,
    message,
  });

  if (error) {
    const needsMigration = /support_tickets/.test(error.message);
    return NextResponse.json(
      {
        error: needsMigration
          ? "نظام الدعم يحتاج تحديث قاعدة البيانات — شغّل schema.sql في Supabase"
          : "تعذّر إرسال التذكرة — حاول مجدداً",
      },
      { status: needsMigration ? 503 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
