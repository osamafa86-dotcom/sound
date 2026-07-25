import { NextRequest, NextResponse } from "next/server";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { addCustomVoice, listCustomVoices } from "@/lib/customVoices";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/serverAuth";

const API_BASE = "https://api.elevenlabs.io/v1";

/**
 * قائمة الأصوات المخصصة (مستنسخة أو مصممة) من حساب ElevenLabs.
 * على الإنتاج (Supabase مهيأ) تُفلتر بملكية المستخدم من سجل custom_voices؛
 * وفي التطوير تظهر كل أصوات الحساب.
 */
export async function GET(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ voices: [], mock: true });

  const res = await fetch(`${API_BASE}/voices`, {
    headers: { "xi-api-key": key },
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ voices: [], error: "تعذر جلب الأصوات" }, { status: 502 });
  }

  const data = await res.json();
  let voices: { id: string; name: string }[] = (data.voices ?? [])
    .filter((v: { category?: string }) => v.category === "cloned" || v.category === "generated")
    .map((v: { voice_id: string; name: string }) => ({ id: v.voice_id, name: v.name }));

  // فلترة الملكية على الإنتاج: كل مستخدم يرى أصواته المسجلة له فقط
  if (getSupabaseAdmin()) {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ voices: [] });
    const owned = new Set((await listCustomVoices(user.id)).map((v) => v.id));
    voices = voices.filter((v) => owned.has(v.id));
  }

  return NextResponse.json({ voices });
}

/** استنساخ صوت جديد من عينة صوتية (Instant Voice Cloning) — بموافقة صريحة */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  // على الإنتاج: الاستنساخ للمسجلين حصراً — للمساءلة ومنع الإساءة
  if (getSupabaseAdmin() && !user) {
    return NextResponse.json({ error: "سجّل الدخول لاستنساخ صوتك" }, { status: 401 });
  }

  const limit = await checkLimit(req, "voiceClone", user?.id ?? null);
  if (!limit.allowed) return limitResponse(limit);

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "استنساخ الصوت غير متاح في الوضع التجريبي — يتطلب مفتاح ElevenLabs" },
      { status: 503 }
    );
  }

  const form = await req.formData().catch(() => null);
  const name = typeof form?.get("name") === "string" ? (form!.get("name") as string).trim() : "";
  const file = form?.get("file");
  const consent = form?.get("consent");

  if (consent !== "true") {
    return NextResponse.json(
      { error: "الموافقة الصريحة مطلوبة: أقرّ أن هذا صوتي أو لديّ إذن موثق من صاحبه" },
      { status: 400 }
    );
  }
  if (!name || !(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "اسم الصوت وملف العينة مطلوبان" }, { status: 400 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "الحد الأقصى لحجم العينة 15 ميغابايت" }, { status: 400 });
  }

  const upstream = new FormData();
  upstream.append("name", name.slice(0, 60));
  upstream.append("files", file, file.name || "sample.webm");
  upstream.append("remove_background_noise", "true");

  const res = await fetch(`${API_BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": key },
    body: upstream,
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = JSON.stringify(data ?? {}).slice(0, 300);
    const needsUpgrade = /cloning|subscription|upgrade|permission|tier|paid/i.test(detail);
    return NextResponse.json(
      {
        error: needsUpgrade
          ? "استنساخ الصوت يتطلب باقة Starter ($5 شهرياً) أو أعلى في ElevenLabs — الخطة المجانية لا تشمل هذه الميزة"
          : "تعذر استنساخ الصوت — تأكد أن العينة تسجيل كلام واضح (30 ثانية إلى 3 دقائق) وحاول مجدداً",
        detail,
      },
      { status: 502 }
    );
  }

  // ربط الصوت بمالكه في سجل المنصة (يتيح فلترة الملكية على الإنتاج)
  await addCustomVoice({
    id: data.voice_id,
    userId: user?.id ?? null,
    name: name.slice(0, 60),
    createdAt: Date.now(),
  }).catch((e) => console.error("custom voice registry insert failed:", e));

  return NextResponse.json({ voiceId: data.voice_id, name: name.slice(0, 60) });
}
