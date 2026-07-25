import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";
import type { DramaScript } from "@/lib/drama/types";

/**
 * البودكاست الذكي — موضوع واحد يتحوّل إلى حلقة حوارية كاملة.
 *
 * الناتج سيناريو بالبنية الدرامية نفسها، فيمرّ على محرك الإنتاج ذاته:
 * كل سطر بصوت مقدّمه وانفعاله. الفرق في التأليف لا في الإنتاج.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export const PODCAST_LIMITS = {
  maxTopicChars: 500,
  maxLines: 40,
  /** أطوال الحلقة بالدقائق التقريبية وعدد الأسطر المقابل */
  lengths: {
    short: { minutes: 3, lines: 16 },
    medium: { minutes: 6, lines: 28 },
    long: { minutes: 10, lines: 40 },
  },
} as const;

export type PodcastLength = keyof typeof PODCAST_LIMITS.lengths;

export type PodcastTone = "informative" | "casual" | "debate" | "storytelling";

const TONES: Record<PodcastTone, string> = {
  informative: "معرفي رصين — شرح واضح مدعوم بمعلومات وأمثلة",
  casual: "ودّي عفوي — حوار خفيف كأنه بين صديقين",
  debate: "نقاشي — وجهتا نظر مختلفتان تتحاوران باحترام",
  storytelling: "سردي مشوّق — الموضوع يُروى كقصة لها بداية وذروة",
};

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "عنوان الحلقة بالعربية — جذاب ومحدد" },
    summary: { type: "string", description: "وصف الحلقة في سطرين، صالح لنشره مع الحلقة" },
    mood: { type: "string", description: "مزاج الحلقة بالعربية في كلمتين" },
    maqamId: { type: "string", enum: MAQAMAT.map((m) => m.id) },
    musicPromptEn: {
      type: "string",
      description:
        "English prompt for a short instrumental podcast intro theme: Arabic instruments, tempo, mood. Instrumental only, under 250 characters.",
    },
    characters: {
      type: "array",
      description: "مقدّما الحلقة — شخصيتان بالضبط",
      items: {
        type: "object",
        properties: {
          id: { type: "string", description: "host1 أو host2" },
          name: { type: "string", description: "اسم عربي طبيعي للمقدّم" },
          description: { type: "string", description: "دوره في الحلقة وطبعه في الحوار" },
          voiceId: { type: "string", enum: VOICES.map((v) => v.id) },
          voiceReason: { type: "string" },
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
          text: { type: "string", description: "نص الحوار مشكّلاً تشكيلاً كاملاً" },
          emotion: { type: "string" },
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

function buildPrompt(topic: string, length: PodcastLength, tone: PodcastTone, dialect: string): string {
  const catalog = VOICES.map(
    (v) => `- ${v.id}: ${v.name} — ${v.gender === "male" ? "ذكر" : "أنثى"}، لهجة ${v.dialect}. ${v.tone}`
  ).join("\n");
  const target = PODCAST_LIMITS.lengths[length];

  return `أنت معدّ ومخرج بودكاست عربي محترف داخل منصة «مقام».

اكتب **حلقة بودكاست حوارية كاملة** بين مقدّمَين اثنين حول هذا الموضوع:
"""
${topic}
"""

**١. المقدّمان**
- شخصيتان بالضبط: \`host1\` و\`host2\`، باسمين عربيين طبيعيين.
- اجعل بينهما تمايزاً واضحاً في الدور: أحدهما يقود الحلقة ويطرح الأسئلة، والآخر يشرح ويضيف العمق — أو حسب النبرة المطلوبة.
- يفضَّل اختلاف الجنس بينهما ليسهل على المستمع التمييز، إلا إذا اقتضى الموضوع غير ذلك.

**٢. الأصوات** من كتالوج المنصة حصراً، وباللهجة ${dialect}:
${catalog}

**٣. بنية الحلقة** (نحو ${target.lines} سطراً، أي ${target.minutes} دقائق تقريباً):
- **افتتاحية**: ترحيب قصير وتقديم الموضوع وإثارة فضول المستمع.
- **صلب الحلقة**: حوار حقيقي متدفق — أسئلة، إجابات، أمثلة ملموسة، مقاطعات لطيفة، اتفاق واختلاف. تجنّب أن يلقي كل مقدّم خطبة منفصلة.
- **خاتمة**: خلاصة في جملتين وتوديع.

**٤. النبرة المطلوبة**: ${TONES[tone]}

**٥. قواعد اللغة والأداء**
- اكتب كل سطر **مشكّلاً تشكيلاً كاملاً**، وحوّل الأرقام والاختصارات إلى صيغتها المنطوقة.
- اجعل الحوار طبيعياً كما يُنطق فعلاً: جمل قصيرة، عبارات وصل («طيب»، «بالضبط»، «خلينا نوضّح»)، لا لغة مكتوبة جامدة.
- لكل سطر: انفعاله، وstability بين 0.35 و0.75 (أقل في الحماس والضحك، أعلى في الشرح الرصين)، وspeed بين 0.9 و1.1، وpauseAfterMs بين 120 و600 (وقفات قصيرة داخل الحوار حتى لا يبدو متقطعاً).
- لا تتجاوز ${PODCAST_LIMITS.maxLines} سطراً.

**٦. موسيقى الافتتاح**: اقترح المقام والبرومبت الإنجليزي لثيم آلي قصير يناسب الموضوع.

**مهم**: اكتب محتوى حقيقياً ذا قيمة عن الموضوع — معلومات وأمثلة وزوايا مفيدة، لا كلاماً إنشائياً عاماً.`;
}

export async function generatePodcast(
  apiKey: string,
  topic: string,
  length: PodcastLength,
  tone: PodcastTone,
  dialect: string
): Promise<DramaScript> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(topic, length, tone, dialect) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.85,
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
    throw new Error("الحلقة أطول من المتاح — جرّب طولاً أقصر");
  }
  if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
    throw new Error("رفض المعدّ هذا الموضوع — جرّب صياغة مختلفة");
  }

  const out = candidate?.content?.parts?.[0]?.text;
  if (!out) throw new Error("استجابة فارغة من معدّ الحلقة");

  return sanitize(JSON.parse(out) as DramaScript);
}

/** تطهير مماثل للسيناريو الدرامي — أصوات صالحة وأسطر مربوطة بمقدّم موجود */
function sanitize(script: DramaScript): DramaScript {
  const characters = (script.characters ?? [])
    .filter((c) => c.id && c.name)
    .slice(0, 2)
    .map((c) => ({
      ...c,
      voiceId: VOICES.some((v) => v.id === c.voiceId) ? c.voiceId : VOICES[0].id,
    }));

  if (!characters.length) throw new Error("لم يُنشئ المعدّ مقدّمي الحلقة");

  const known = new Set(characters.map((c) => c.id));
  const lines = (script.lines ?? [])
    .filter((l) => typeof l.text === "string" && l.text.trim())
    .slice(0, PODCAST_LIMITS.maxLines)
    .map((l) => ({
      characterId: known.has(l.characterId) ? l.characterId : characters[0].id,
      text: l.text.trim().slice(0, 600),
      emotion: l.emotion || "ودّي",
      stability: clamp(Number(l.stability), 0, 1, 0.5),
      speed: clamp(Number(l.speed), 0.7, 1.2, 1),
      pauseAfterMs: Math.round(clamp(Number(l.pauseAfterMs), 0, 1500, 250)),
    }));

  if (!lines.length) throw new Error("لم يُنتج المعدّ أي حوار");

  return {
    ...script,
    maqamId: MAQAMAT.some((m) => m.id === script.maqamId) ? script.maqamId : MAQAMAT[0].id,
    characters,
    lines,
  };
}

function clamp(n: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
