import { PROMPT_TYPES, type CraftedPrompt } from "./promptSmith";

/**
 * وكيل البرومبتات — غرفة صياغة بثلاثة أدوار تدور حلقتها حتى الجودة:
 *
 * المهندس يكتب مسودة (معلناً افتراضاته) ← الحكم/الناقد يقيّمها على
 * معايير مرقمة ويهاجم ثغراتها ← المحسِّن يعالج النقد ← وهكذا حتى
 * تجاوز العتبة أو استنفاد الجولات. العميل يقود الحلقة خطوة خطوة
 * فتظهر الجولات حية في الواجهة — شفافية تعلّم هندسة البرومبتات.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/** عتبة القبول (من 100) وحد الجولات — توازن جودة/كلفة */
export const PASS_SCORE = 85;
export const MAX_ROUNDS = 3;

export type AgentIssue = { severity: "عالية" | "متوسطة" | "منخفضة"; issue: string; fix: string };

export type AgentReview = {
  clarity: number;
  completeness: number;
  platformFit: number;
  executability: number;
  total: number;
  verdict: string;
  issues: AgentIssue[];
};

export type AgentDraft = CraftedPrompt & { assumptions: string[] };

/** نداء Gemini بمخرجات منظمة — مشترك لكل الأدوار */
async function geminiJson<T>(
  apiKey: string,
  system: string,
  user: string,
  schema: object,
  temperature: number,
  maxTokens = 4096
): Promise<T> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("استجابة فارغة");
  return JSON.parse(text) as T;
}

function typeOf(typeId: string) {
  const type = PROMPT_TYPES.find((t) => t.id === typeId);
  if (!type) throw new Error("نوع برومبت غير معروف");
  return type;
}

const CRAFT_FIELDS = {
  title: { type: "string", description: "اسم موجز للبرومبت بالعربية" },
  prompt: { type: "string", description: "البرومبت الجاهز للصق باللغة الأنسب للمنصة" },
  promptAlt: { type: "string", description: "الترجمة المقابلة لفهم المستخدم — فارغة إن لم تفد" },
  negativePrompt: { type: "string", description: "البرومبت السلبي للصور/الفيديو — وإلا فارغ" },
  tips: { type: "array", description: "٣ نصائح عملية للمنصة", items: { type: "string" } },
};

/** ١) المهندس: مسودة أولى بافتراضات معلنة (+أمثلة ناجحة من الذاكرة إن وُجدت) */
export async function agentDraft(
  apiKey: string,
  typeId: string,
  brief: string,
  platform?: string,
  exemplars?: string[]
): Promise<AgentDraft> {
  const type = typeOf(typeId);
  const system = `أنت «المهندس» في غرفة صياغة البرومبتات بمنصة لحّن — اختصاصك: ${type.name}.

عدّة الخبير:
${type.expertise}

${platform ? `المنصة المستهدفة: ${platform} — التزم بلهجتها وحدودها.` : "اختر الصياغة الأصلح لمنصات هذا النوع."}
لغة البرومبت الرئيسة: ${type.primaryLang === "en" ? "الإنجليزية (مع ترجمة عربية في promptAlt)" : "العربية"}.
${exemplars?.length ? `\nبرومبتات سابقة أثبتت نجاحها لدى مستخدمينا — احتذِ بمستوى تفصيلها:\n${exemplars.map((e) => `- ${e.slice(0, 300)}`).join("\n")}\n` : ""}
اكتب المسودة كاملة التفاصيل بلا أسئلة رجوع، وأعلن في assumptions القرارات التي اتخذتها عن المستخدم (٣ كحد أقصى، بالعربية) ليعدّلها إن شاء.`;

  const data = await geminiJson<AgentDraft>(
    apiKey,
    system,
    `طلب المستخدم:\n${brief}`,
    {
      type: "object",
      properties: {
        ...CRAFT_FIELDS,
        assumptions: {
          type: "array",
          description: "قرارات احترافية اتخذتها لملء فراغات الطلب — بالعربية",
          items: { type: "string" },
        },
      },
      required: ["title", "prompt", "tips", "assumptions"],
      propertyOrdering: ["title", "prompt", "promptAlt", "negativePrompt", "tips", "assumptions"],
    },
    0.7
  );
  return {
    ...data,
    promptAlt: data.promptAlt || undefined,
    negativePrompt: data.negativePrompt || undefined,
    tips: (data.tips ?? []).slice(0, 5),
    assumptions: (data.assumptions ?? []).slice(0, 4),
  };
}

/** ٢) الحكم الناقد: درجات مرقمة + هجوم على الثغرات بإصلاح مقترح لكل ثغرة */
export async function agentReview(
  apiKey: string,
  typeId: string,
  brief: string,
  prompt: string,
  platform?: string
): Promise<AgentReview> {
  const type = typeOf(typeId);
  const system = `أنت «الحكم الناقد» في غرفة صياغة البرومبتات — خبير ${type.name} صارم لا يجامل.

عدّة الخبير التي تحاكم بها:
${type.expertise}
${platform ? `المنصة المستهدفة: ${platform}.` : ""}

قيّم البرومبت من 25 لكل معيار (المجموع من 100):
- clarity: الوضوح — لا غموض ولا تناقض ولا حشو يشتت المحرك
- completeness: الاكتمال — كل عناصر حرفة ${type.name} حاضرة
- platformFit: التزام لهجة المنصة ومعاملاتها وحدودها
- executability: قابلية التنفيذ — هل سيخرج المحرك فعلاً ما أراده المستخدم؟

ثم اذكر الثغرات (حتى ٤) مرتبة بالخطورة، ولكل ثغرة إصلاح محدد قابل للتطبيق حرفياً.
كن صارماً: 85+ للبرومبتات المتقنة فعلاً فقط.`;

  const data = await geminiJson<AgentReview>(
    apiKey,
    system,
    `طلب المستخدم الأصلي:\n${brief}\n\nالبرومبت المُحاكم:\n"""${prompt}"""`,
    {
      type: "object",
      properties: {
        clarity: { type: "number" },
        completeness: { type: "number" },
        platformFit: { type: "number" },
        executability: { type: "number" },
        verdict: { type: "string", description: "حكم عربي في جملة" },
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["عالية", "متوسطة", "منخفضة"] },
              issue: { type: "string" },
              fix: { type: "string" },
            },
            required: ["severity", "issue", "fix"],
            propertyOrdering: ["severity", "issue", "fix"],
          },
        },
      },
      required: ["clarity", "completeness", "platformFit", "executability", "verdict", "issues"],
      propertyOrdering: ["clarity", "completeness", "platformFit", "executability", "verdict", "issues"],
    },
    0.2
  );

  const clamp = (n: number) => Math.min(25, Math.max(0, Math.round(Number(n) || 0)));
  const clarity = clamp(data.clarity);
  const completeness = clamp(data.completeness);
  const platformFit = clamp(data.platformFit);
  const executability = clamp(data.executability);
  return {
    clarity,
    completeness,
    platformFit,
    executability,
    total: clarity + completeness + platformFit + executability,
    verdict: data.verdict,
    issues: (data.issues ?? []).slice(0, 4),
  };
}

/** ٣) المحسِّن: يعالج نقد الحكم دون فقدان ما نجح في المسودة */
export async function agentRefine(
  apiKey: string,
  typeId: string,
  brief: string,
  current: CraftedPrompt,
  issues: AgentIssue[],
  platform?: string
): Promise<CraftedPrompt> {
  const type = typeOf(typeId);
  const system = `أنت «المحسِّن» في غرفة صياغة البرومبتات — اختصاصك: ${type.name}.
${platform ? `المنصة المستهدفة: ${platform}.` : ""}
عدّة الخبير:
${type.expertise}

عالج ثغرات الناقد واحدة واحدة دون إفساد ما نجح، وأعد البرومبت كاملاً محسّناً بنفس اللغة.`;

  const data = await geminiJson<CraftedPrompt>(
    apiKey,
    system,
    `طلب المستخدم:\n${brief}\n\nالبرومبت الحالي:\n"""${current.prompt}"""\n${
      current.negativePrompt ? `\nالبرومبت السلبي الحالي:\n"""${current.negativePrompt}"""\n` : ""
    }\nثغرات الناقد المطلوب علاجها:\n${issues
      .map((i) => `- [${i.severity}] ${i.issue} — الإصلاح: ${i.fix}`)
      .join("\n")}`,
    {
      type: "object",
      properties: CRAFT_FIELDS,
      required: ["title", "prompt", "tips"],
      propertyOrdering: ["title", "prompt", "promptAlt", "negativePrompt", "tips"],
    },
    0.5
  );
  return {
    title: data.title || current.title,
    prompt: data.prompt,
    promptAlt: data.promptAlt || current.promptAlt,
    negativePrompt: data.negativePrompt || current.negativePrompt,
    tips: (data.tips ?? current.tips).slice(0, 5),
  };
}

/** ٤) الناقل: نسخ البرومبت النهائي بلهجات بقية منصات النوع */
export async function agentPort(
  apiKey: string,
  typeId: string,
  prompt: string,
  targets: string[]
): Promise<{ platform: string; prompt: string }[]> {
  const type = typeOf(typeId);
  const data = await geminiJson<{ variants: { platform: string; prompt: string }[] }>(
    apiKey,
    `أنت خبير لهجات منصات ${type.name}. انقل البرومبت لكل منصة مستهدفة بلهجتها ومعاملاتها وحدودها الفعلية — نفس المضمون بصياغة كل منصة، لا مجرد نسخ.`,
    `البرومبت الأصلي:\n"""${prompt}"""\n\nالمنصات المستهدفة: ${targets.join("، ")}`,
    {
      type: "object",
      properties: {
        variants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              platform: { type: "string" },
              prompt: { type: "string" },
            },
            required: ["platform", "prompt"],
            propertyOrdering: ["platform", "prompt"],
          },
        },
      },
      required: ["variants"],
      propertyOrdering: ["variants"],
    },
    0.4,
    8192
  );
  return (data.variants ?? []).slice(0, targets.length);
}
