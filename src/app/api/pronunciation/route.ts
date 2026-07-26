import { NextRequest, NextResponse } from "next/server";
import { addRules, invalidateRulesCache, listRules, removeRules } from "@/lib/pronunciation";
import { checkLimit, limitResponse } from "@/lib/rateLimit";

/** عرض القواعد المتراكمة في ذاكرة النطق */
export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ rules: [], learned: 0 });

  const rules = await listRules(key).catch(() => []);
  return NextResponse.json({ rules, learned: rules.length });
}

/** تعليم المنصة نطقاً جديداً */
export async function POST(req: NextRequest) {
  const limit = await checkLimit(req, "pronunciation");
  if (!limit.allowed) return limitResponse(limit);

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
    invalidateRulesCache(); // التعليم الجديد يصل توليدات الأغاني فوراً
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
  invalidateRulesCache();
  return NextResponse.json({ ok: true });
}
