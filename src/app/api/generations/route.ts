import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkLimit, limitResponse } from "@/lib/rateLimit";

/** قائمة أعمال المستخدم الحالي */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ generations: [] });

  const FIELDS = "id, kind, title, content, voice_id, maqam_id, style_id, provider, audio_path, created_at";
  type Row = { audio_path: string | null; is_public?: boolean } & Record<string, unknown>;

  const first = await supabase
    .from("generations")
    .select(`${FIELDS}, is_public`)
    .order("created_at", { ascending: false })
    .limit(100);

  let data = first.data as Row[] | null;
  let error = first.error;

  // قاعدة لم تُحدَّث بعد بعمود المعرض العام — نعمل بدونه بدل كسر المكتبة
  if (error && /is_public/.test(error.message)) {
    const fallback = await supabase
      .from("generations")
      .select(FIELDS)
      .order("created_at", { ascending: false })
      .limit(100);
    data = fallback.data as Row[] | null;
    error = fallback.error;
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // روابط مؤقتة موقّعة للاستماع والتنزيل (الملفات خاصة بأصحابها)
  const generations = await Promise.all(
    (data ?? []).map(async (g) => {
      if (!g.audio_path) return { ...g, url: null };
      const { data: signed } = await supabase.storage
        .from("audio")
        .createSignedUrl(g.audio_path, 60 * 60);
      return { ...g, url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ generations });
}

/** حفظ عمل جديد في المكتبة (الملف الصوتي + بياناته) */
export async function POST(req: NextRequest) {
  const limit = await checkLimit(req, "tts");
  if (!limit.allowed) return limitResponse(limit);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "سجّل الدخول لحفظ أعمالك" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "الملف الصوتي مطلوب" }, { status: 400 });
  }
  if (!["tts", "song", "recording"].includes(kind)) {
    return NextResponse.json({ error: "نوع العمل غير صحيح" }, { status: 400 });
  }
  if (file.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "حجم الملف كبير جداً" }, { status: 400 });
  }

  const ext = file.type === "audio/wav" ? "wav" : "mp3";
  const path = `${user.id}/${kind}-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("audio")
    .upload(path, file, { contentType: file.type || "audio/mpeg", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const str = (k: string) => {
    const v = form?.get(k);
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : null;
  };

  const { data, error } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      kind,
      title: str("title"),
      content: str("content"),
      voice_id: str("voiceId"),
      maqam_id: str("maqamId"),
      style_id: str("styleId"),
      provider: str("provider"),
      settings: JSON.parse(str("settings") ?? "{}"),
      audio_path: path,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from("audio").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}

/** نشر عمل في المعرض العام أو سحبه منه — قرار صاحبه وحده */
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "المعرّف مطلوب" }, { status: 400 });

  const { error } = await supabase
    .from("generations")
    .update({ is_public: body?.isPublic === true })
    .eq("id", id);

  if (error) {
    const needsMigration = /is_public|policy/.test(error.message);
    return NextResponse.json(
      {
        error: needsMigration
          ? "المعرض العام يحتاج تحديث قاعدة البيانات — شغّل schema.sql في Supabase أولاً"
          : error.message,
      },
      { status: needsMigration ? 503 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}

/** حذف عمل من المكتبة */
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "غير مصرّح" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "المعرّف مطلوب" }, { status: 400 });

  const { data: row } = await supabase
    .from("generations")
    .select("audio_path")
    .eq("id", id)
    .single();

  if (row?.audio_path) {
    await supabase.storage.from("audio").remove([row.audio_path]);
  }
  const { error } = await supabase.from("generations").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
