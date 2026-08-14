import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";
import { dialectInstruction, voiceCatalogText, voicesForDialect } from "@/lib/dialects";
import { DRAMA_LIMITS, type DramaScript } from "./types";

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

function buildSchema(dialect?: string) {
  const allowedVoices = voicesForDialect(dialect).map((v) => v.id);
  return {
  type: "object",
  properties: {
    title: { type: "string", description: "عنوان العمل بالعربية" },
    summary: { type: "string", description: "ملخص العمل في سطر أو سطرين" },
    mood: { type: "string", description: "مزاج العمل العام بالعربية في كلمتين" },
    maqamId: { type: "string", enum: MAQAMAT.map((m) => m.id) },
    musicPromptEn: {
      type: "string",
      description:
        "English prompt for instrumental background music matching the drama's mood: maqam, Arabic instruments, tempo, atmosphere. Under 300 characters, instrumental only.",
    },
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "معرّف لاتيني قصير: narrator, char1, char2..." },
          name: { type: "string" },
          description: { type: "string", description: "العمر والطبع والدور، بالعربية" },
          voiceId: { type: "string", enum: allowedVoices },
          voiceReason: { type: "string", description: "سبب اختيار الصوت في جملة قصيرة" },
        },
        required: ["id", "name", "description", "voiceId", "voiceReason"],
        propertyOrdering: ["id", "name", "description", "voiceId", "voiceReason"],
      },
    },
    lines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          characterId: { type: "string" },
          text: { type: "string", description: "النص مشكّلاً تشكيلاً كاملاً" },
          emotion: { type: "string", description: "الحالة الشعورية بالعربية في كلمة أو كلمتين" },
          stability: { type: "number" },
          speed: { type: "number" },
          pauseAfterMs: { type: "number" },
        },
        required: ["characterId", "text", "emotion", "stability", "speed", "pauseAfterMs"],
        propertyOrdering: ["characterId", "text", "emotion", "stability", "speed", "pauseAfterMs"],
      },
    },
  },
    required: ["title", "summary", "mood", "maqamId", "musicPromptEn", "characters", "lines"],
    propertyOrdering: ["title", "summary", "mood", "maqamId", "musicPromptEn", "characters", "lines"],
  };
}

function buildPrompt(text: string, dialect?: string): string {
  const catalog = voiceCatalogText(dialect);
  const maqamList = MAQAMAT.map((m) => `- ${m.id}: ${m.name} (${m.mood})`).join("\n");

  return `أنت مخرج درامي إذاعي محترف، تحوّل النصوص إلى أعمال مسموعة داخل منصة «لحّن».

حوّل النص التالي إلى **سيناريو إذاعي جاهز للإنتاج** وفق ما يلي:

**١. استخرج الشخصيات**
- حدد كل شخصية متحدثة، وأضف دائماً شخصية بمعرّف \`narrator\` للسرد وما بين الحوارات.
- إن كان النص سرداً خالصاً بلا حوار، فاجعل الراوي شخصية واحدة، وأضف شخصيات فقط إن ورد كلام منقول.
- لكل شخصية: اسم ووصف موجز (العمر والطبع والدور).

**٢. اللغة والأداء**
${dialectInstruction(dialect)}
واكتب كل سطر **مشكّلاً تشكيلاً كاملاً**.

**٣. وزّع الأصوات** من كتالوج المنصة حصراً — راعِ الجنس والعمر واللهجة وطابع الصوت. لا تعطِ شخصيتين الصوت نفسه إلا للضرورة:
${catalog}

**٤. قسّم النص إلى أسطر** (بحد أقصى ${DRAMA_LIMITS.maxLines} سطراً):
- كل سطر: من يقوله (characterId)، ونصه **مشكّلاً تشكيلاً كاملاً** ومطبّعاً (الأرقام والاختصارات إلى صيغتها المنطوقة).
- احذف علامات الحوار مثل «قال فلان:» من نص السطر إن كان الصوت وحده يكفي للتمييز، وأبقِها في سطر الراوي إن كانت جزءاً من السرد.
- لكل سطر: الحالة الشعورية، وقيمة stability بين 0 و1 (اخفضها إلى 0.25–0.4 في الانفعال والصراخ والبكاء، وارفعها إلى 0.6–0.8 في السرد المتزن)، وقيمة speed بين 0.85 و1.15، وpauseAfterMs بين 150 و1200 حسب إيقاع المشهد (وقفة أطول بين المشاهد وبعد الجُمل المؤثرة).

**٥. اقترح موسيقى خلفية**: المقام الأنسب لمزاج العمل، وبرومبت إنجليزي لموسيقى **آلية بحتة** (بلا غناء) تصلح خلفية هادئة لا تطغى على الحوار:
${maqamList}

**قواعد ملزمة:** حافظ على معنى النص وأحداثه وترتيبه — لا تختصر ولا تخترع أحداثاً. كل characterId في الأسطر يجب أن يطابق معرّف شخصية عرّفتها. لا تتجاوز ${DRAMA_LIMITS.maxLines} سطراً؛ إن كان النص أطول فادمج الجمل المتقاربة في سطر واحد للشخصية نفسها.

النص:
"""
${text}
"""`;
}

export async function analyzeDrama(
  apiKey: string,
  text: string,
  dialect?: string
): Promise<DramaScript> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(text, dialect) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: buildSchema(dialect),
          temperature: 0.4,
          maxOutputTokens: 40000,
        },
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }

  const json = await res.json();
  const candidate = json?.candidates?.[0];
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("النص طويل جداً على التحليل دفعة واحدة — جرّب نصاً أقصر");
  }
  if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
    throw new Error("رفض المحلّل معالجة هذا النص — جرّب نصاً مختلفاً");
  }

  const out = candidate?.content?.parts?.[0]?.text;
  if (!out) throw new Error("استجابة فارغة من المحلّل");

  return sanitize(JSON.parse(out) as DramaScript, dialect);
}

/** تطهير الناتج: أصوات صالحة، أسطر مربوطة بشخصيات موجودة، وقيم ضمن نطاقها */
function sanitize(script: DramaScript, dialect?: string): DramaScript {
  const allowed = voicesForDialect(dialect);
  const characters = (script.characters ?? [])
    .filter((c) => c.id && c.name)
    .map((c) => ({
      ...c,
      voiceId: allowed.some((v) => v.id === c.voiceId) ? c.voiceId : allowed[0].id,
    }));

  if (!characters.length) throw new Error("لم يتعرّف المحلّل على أي شخصية في النص");

  const known = new Set(characters.map((c) => c.id));
  const fallbackId = characters.find((c) => c.id === "narrator")?.id ?? characters[0].id;

  const lines = (script.lines ?? [])
    .filter((l) => typeof l.text === "string" && l.text.trim())
    .slice(0, DRAMA_LIMITS.maxLines)
    .map((l) => ({
      characterId: known.has(l.characterId) ? l.characterId : fallbackId,
      text: l.text.trim().slice(0, DRAMA_LIMITS.maxLineChars),
      emotion: l.emotion || "هادئ",
      stability: clamp(Number(l.stability), 0, 1, 0.5),
      speed: clamp(Number(l.speed), 0.7, 1.2, 1),
      pauseAfterMs: Math.round(clamp(Number(l.pauseAfterMs), 0, 2000, 300)),
    }));

  if (!lines.length) throw new Error("لم يُنتج المحلّل أي سطر قابل للنطق");

  // إسقاط الشخصيات التي لم يُسند إليها أي سطر
  const used = new Set(lines.map((l) => l.characterId));

  return {
    ...script,
    maqamId: MAQAMAT.some((m) => m.id === script.maqamId) ? script.maqamId : MAQAMAT[0].id,
    characters: characters.filter((c) => used.has(c.id)),
    lines,
  };
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
