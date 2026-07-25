import { NextRequest, NextResponse } from "next/server";
import { elevenLabsCloneVoice } from "@/lib/providers/elevenlabs";
import { addCustomVoice } from "@/lib/customVoices";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { consumeRateLimit, rateLimitFor, rateLimitKey } from "@/lib/rateLimit";
import { clientIp, getUserFromRequest } from "@/lib/serverAuth";

export const maxDuration = 120;

const MAX_SAMPLE_BYTES = 25 * 1024 * 1024;

/**
 * استنساخ صوت من عينة تسجيل — يتطلب موافقة صريحة على أن الصوت صوت
 * المستخدم نفسه أو لديه إذن موثق من صاحبه، وحساباً مسجلاً على الإنتاج.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  // على الإنتاج (Supabase مهيأ): الاستنساخ للمسجلين حصراً — للمساءلة ومنع الإساءة
  if (getSupabaseAdmin() && !user) {
    return NextResponse.json({ error: "سجّل الدخول لاستنساخ صوتك" }, { status: 401 });
  }

  const allowed = await consumeRateLimit(
    rateLimitKey("clone", user?.id ?? null, clientIp(req)),
    rateLimitFor("clone", !!user)
  );
  if (!allowed) {
    return NextResponse.json({ error: "تجاوزت الحد المسموح من عمليات الاستنساخ — حاول لاحقاً" }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const name = form?.get("name");
  const consent = form?.get("consent");
  const samples = (form?.getAll("samples") ?? []).filter(
    (s): s is File => s instanceof Blob && s.size > 0
  );

  if (consent !== "true") {
    return NextResponse.json(
      { error: "الموافقة الصريحة مطلوبة: أقرّ أن هذا صوتي أو لديّ إذن موثق من صاحبه" },
      { status: 400 }
    );
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "اكتب اسماً للصوت المستنسخ" }, { status: 400 });
  }
  if (!samples.length) {
    return NextResponse.json({ error: "أرفق عينة تسجيل واحدة على الأقل (دقيقة تكفي)" }, { status: 400 });
  }
  if (samples.some((s) => s.size > MAX_SAMPLE_BYTES)) {
    return NextResponse.json({ error: "الحد الأقصى لحجم العينة 25 ميغابايت" }, { status: 400 });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "استنساخ الصوت يتطلب ربط مفتاح ElevenLabs" },
      { status: 503 }
    );
  }

  try {
    const voiceId = await elevenLabsCloneVoice(apiKey, name.trim().slice(0, 60), samples.slice(0, 3));
    await addCustomVoice({
      id: voiceId,
      userId: user?.id ?? null,
      name: name.trim().slice(0, 60),
      createdAt: Date.now(),
    });
    return NextResponse.json({ voiceId: `clone-${voiceId}`, name: name.trim() }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "تعذّر الاستنساخ";
    console.error("Voice clone failed:", message);
    // رسالة أوضح للحالة الشائعة: الباقة لا تشمل الاستنساخ
    const friendly = /can_not_use_instant_voice_cloning|subscription|upgrade/i.test(message)
      ? "باقة ElevenLabs الحالية لا تشمل استنساخ الأصوات — تحتاج باقة Starter فأعلى"
      : message;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}
