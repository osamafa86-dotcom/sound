import { NextRequest, NextResponse } from "next/server";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { addCustomVoice } from "@/lib/customVoices";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getUserFromRequest } from "@/lib/serverAuth";

const API_BASE = "https://api.elevenlabs.io/v1";

/** نص المعاينة الافتراضي — عربي شامي حتى تُسمع اللهجة في المعاينة نفسها */
const DEFAULT_PREVIEW_TEXT =
  "أهلاً وسهلاً فيكم، هلّق رح نجرّب هالصوت ونشوف كيف بيطلع. الحكي العربي إلو نكهة تانية لما يكون طبيعي وقريب من القلب، وهيك منقدر نحكم عليه منيح.";

/** الخطوة 1: توليد معاينات صوتية من وصف نصي — النداء المكلف، فهنا يقع الخصم */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const limit = await checkLimit(req, "voiceDesign", user?.id ?? null);
  if (!limit.allowed) return limitResponse(limit);

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "تصميم الأصوات يتطلب مفتاح ElevenLabs" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const description: string = body?.description?.trim() ?? "";
  const previewText: string = body?.text?.trim() || DEFAULT_PREVIEW_TEXT;

  if (description.length < 20) {
    return NextResponse.json(
      { error: "اكتب وصفاً أوضح للصوت (20 حرفاً على الأقل) — مثال: رجل فلسطيني في الأربعين، صوت دافئ وعميق بلهجة شامية" },
      { status: 400 }
    );
  }

  const res = await fetch(`${API_BASE}/text-to-voice/design`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_description: description.slice(0, 1000),
      text: previewText.slice(0, 1000),
      model_id: "eleven_multilingual_ttv_v2",
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = JSON.stringify(data ?? {}).slice(0, 300);
    const needsUpgrade = /subscription|upgrade|permission|tier|paid/i.test(detail);
    return NextResponse.json(
      {
        error: needsUpgrade
          ? "تصميم الأصوات يتطلب باقة مدفوعة في ElevenLabs"
          : "تعذّر تصميم الصوت — جرّب وصفاً مختلفاً",
        detail,
      },
      { status: 502 }
    );
  }

  const previews = (data?.previews ?? []).map(
    (p: { generated_voice_id: string; audio_base_64?: string; media_type?: string }) => ({
      generatedVoiceId: p.generated_voice_id,
      audio: p.audio_base_64,
      mediaType: p.media_type ?? "audio/mpeg",
    })
  );

  return NextResponse.json({ previews });
}

/** الخطوة 2: حفظ المعاينة المختارة كصوت دائم في المكتبة */
export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  // على الإنتاج: حفظ الصوت المصمم للمسجلين حصراً — ليُربط بمالكه ويظهر له وحده
  if (getSupabaseAdmin() && !user) {
    return NextResponse.json({ error: "سجّل الدخول لحفظ الصوت المصمم" }, { status: 401 });
  }
  // الحفظ نداء رخيص — نطاق «حفظ» بلا كلفة كي لا يُخصم التصميم مرتين
  const limit = await checkLimit(req, "save", user?.id ?? null);
  if (!limit.allowed) return limitResponse(limit);

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "تصميم الأصوات يتطلب مفتاح ElevenLabs" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const name: string = body?.name?.trim() ?? "";
  const description: string = body?.description?.trim() ?? "";
  const generatedVoiceId: string = body?.generatedVoiceId ?? "";

  if (!name || !generatedVoiceId) {
    return NextResponse.json({ error: "اسم الصوت والمعاينة المختارة مطلوبان" }, { status: 400 });
  }

  const res = await fetch(`${API_BASE}/text-to-voice`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      voice_name: name.slice(0, 60),
      voice_description: description.slice(0, 1000),
      generated_voice_id: generatedVoiceId,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    return NextResponse.json(
      { error: "تعذّر حفظ الصوت", detail: JSON.stringify(data ?? {}).slice(0, 300) },
      { status: 502 }
    );
  }

  // ربط الصوت المصمم بمالكه في سجل المنصة (فلترة الملكية على الإنتاج)
  if (data?.voice_id) {
    await addCustomVoice({
      id: data.voice_id,
      userId: user?.id ?? null,
      name: name.slice(0, 60),
      createdAt: Date.now(),
    }).catch((e) => console.error("custom voice registry insert failed:", e));
  }

  return NextResponse.json({ voiceId: data?.voice_id, name: name.slice(0, 60) });
}
