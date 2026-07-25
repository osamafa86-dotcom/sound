import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://api.elevenlabs.io/v1";

/**
 * استكشاف مكتبة الأصوات المشتركة في ElevenLabs — تُستخدم لإيجاد أصوات عربية أصلية
 * (متحدثون أصليون) بدل الأصوات الإنجليزية الافتراضية.
 * تدعم الترقيم والفلترة باللهجة والجنس للبحث الشامل.
 */
export async function GET(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "لا يوجد مفتاح ElevenLabs" }, { status: 503 });

  const q = req.nextUrl.searchParams;
  const url = new URL(`${API_BASE}/shared-voices`);
  url.searchParams.set("language", q.get("language") ?? "ar");
  url.searchParams.set("page_size", q.get("page_size") ?? "100");
  for (const key of ["search", "accent", "gender", "age", "use_cases", "page"]) {
    const value = q.get(key);
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url, { headers: { "xi-api-key": key }, cache: "no-store" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `ElevenLabs ${res.status}`, detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  const data = await res.json();
  const voices = (data.voices ?? []).map(
    (v: {
      voice_id: string;
      name: string;
      gender?: string;
      accent?: string;
      age?: string;
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
      age: v.age,
      descriptive: v.descriptive,
      description: v.description,
      useCase: v.use_case,
      popularity: v.cloned_by_count,
      preview: v.preview_url,
    })
  );

  return NextResponse.json({ count: voices.length, hasMore: data.has_more ?? false, voices });
}
