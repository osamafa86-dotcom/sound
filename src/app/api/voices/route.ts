import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.elevenlabs.io/v1";

/** قائمة الأصوات المستنسخة في حساب ElevenLabs */
export async function GET() {
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
  const voices = (data.voices ?? [])
    .filter((v: { category?: string }) => v.category === "cloned" || v.category === "generated")
    .map((v: { voice_id: string; name: string }) => ({ id: v.voice_id, name: v.name }));

  return NextResponse.json({ voices });
}

/** استنساخ صوت جديد من عينة صوتية (Instant Voice Cloning) */
export async function POST(req: NextRequest) {
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

  return NextResponse.json({ voiceId: data.voice_id, name: name.slice(0, 60) });
}
