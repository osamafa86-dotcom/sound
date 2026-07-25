import { NextRequest, NextResponse } from "next/server";
import { addRules, findDictionary, removeRules, type PronunciationRule } from "@/lib/pronunciation";

const API_BASE = "https://api.elevenlabs.io/v1";

/** عرض القواعد المتراكمة في ذاكرة النطق */
export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ rules: [], learned: 0 });

  const dict = await findDictionary(key).catch(() => null);
  if (!dict) return NextResponse.json({ rules: [], learned: 0 });

  const res = await fetch(
    `${API_BASE}/pronunciation-dictionaries/${dict.id}/${dict.versionId}/download`,
    { headers: { "xi-api-key": key }, cache: "no-store" }
  );
  if (!res.ok) return NextResponse.json({ rules: [], learned: 0, dictId: dict.id });

  // ملف PLS — نستخرج أزواج (الكلمة ← النطق) منه
  const xml = await res.text();
  const rules: PronunciationRule[] = [];
  const lexemeRe = /<lexeme>([\s\S]*?)<\/lexeme>/g;
  let m: RegExpExecArray | null;
  while ((m = lexemeRe.exec(xml))) {
    const word = m[1].match(/<grapheme>([\s\S]*?)<\/grapheme>/)?.[1]?.trim();
    const alias = m[1].match(/<alias>([\s\S]*?)<\/alias>/)?.[1]?.trim();
    if (word && alias) rules.push({ word, alias });
  }

  return NextResponse.json({ rules, learned: rules.length, dictId: dict.id });
}

/** تعليم المنصة نطقاً جديداً */
export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "ذاكرة النطق تتطلب مفتاح ElevenLabs" }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const word: string = body?.word?.trim() ?? "";
  const alias: string = body?.alias?.trim() ?? "";

  if (!word || !alias) {
    return NextResponse.json({ error: "الكلمة والنطق الصحيح مطلوبان" }, { status: 400 });
  }
  if (word.length > 100 || alias.length > 200) {
    return NextResponse.json({ error: "النص المدخل طويل جداً" }, { status: 400 });
  }

  try {
    const dict = await addRules(key, [{ word, alias }]);
    return NextResponse.json({ ok: true, dictId: dict.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "تعذّر حفظ النطق" },
      { status: 502 }
    );
  }
}

/** التراجع عن نطق محفوظ */
export async function DELETE(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "مفتاح مفقود" }, { status: 503 });

  const word = req.nextUrl.searchParams.get("word");
  if (!word) return NextResponse.json({ error: "الكلمة مطلوبة" }, { status: 400 });

  await removeRules(key, [word]).catch(() => {});
  return NextResponse.json({ ok: true });
}
