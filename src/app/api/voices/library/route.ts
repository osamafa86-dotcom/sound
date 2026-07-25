import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.elevenlabs.io/v1";

/**
 * استكشاف مكتبة الأصوات المشتركة في ElevenLabs — تُستخدم لإيجاد أصوات عربية أصلية
 * (متحدثون أصليون) بدل الأصوات الإنجليزية الافتراضية.
 */
export async function GET(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "لا يوجد مفتاح ElevenLabs" }, { status: 503 });

  const language = req.nextUrl.searchParams.get("language") ?? "ar";
  const search = req.nextUrl.searchParams.get("search") ?? "";
  const pageSize = req.nextUrl.searchParams.get("page_size") ?? "40";

  const url = new URL(`${API_BASE}/shared-voices`);
  url.searchParams.set("language", language);
  url.searchParams.set("page_size", pageSize);
  if (search) url.searchParams.set("search", search);

  const res = await fetch(url, { headers: { "xi-api-key": key }, cache: "no-store" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json({ error: `ElevenLabs ${res.status}`, detail: detail.slice(0, 300) }, { status: 502 });
  }

  const data = await res.json();
  const voices = (data.voices ?? []).map(
    (v: {
      voice_id: string;
      name: string;
      gender?: string;
      accent?: string;
      language?: string;
      descriptive?: string;
      description?: string;
      use_case?: string;
      cloned_by_count?: number;
      preview_url?: string;
    }) => ({
      id: v.voice_id,
      name: v.name,
      gender: v.gender,
      accent: v.accent,
      language: v.language,
      descriptive: v.descriptive,
      description: v.description,
      useCase: v.use_case,
      popularity: v.cloned_by_count,
      preview: v.preview_url,
    })
  );

  return NextResponse.json({ count: voices.length, voices });
}
