/**
 * مهندس البرومبتات — اختصاصي صياغة لكل نوع مادة.
 *
 * لكل نوع «عدّة خبير» حقيقية: قواعد الحرفة التي يبنى عليها البرومبت
 * (الهرم المقلوب للخبر، لغة الكاميرا للفيديو، معجم الإضاءة للصور...)،
 * فيخرج برومبت جاهز للصق في المنصة المستهدفة — لا نصائح عامة.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export type PromptType = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  /** المنصات المستهدفة المناسبة لهذا النوع */
  platforms: string[];
  /** لغة البرومبت الرئيسة المتوقعة */
  primaryLang: "ar" | "en";
  /** عدّة الخبير — قواعد الحرفة التي يلتزم بها المهندس */
  expertise: string;
};

export const PROMPT_TYPES: PromptType[] = [
  {
    id: "news",
    name: "نص إخباري",
    icon: "📰",
    desc: "خبر أو تقرير أو موجز نشرة بلغة صحفية محترفة",
    platforms: ["ChatGPT / Claude / Gemini", "منصة مقام (تعليق صوتي)"],
    primaryLang: "ar",
    expertise: `قواعد البرومبت الإخباري المحترف:
- الهرم المقلوب: مقدمة تجيب من/ماذا/متى/أين/لماذا في جملتين، ثم التفاصيل تنازلياً بالأهمية.
- لغة محايدة موضوعية بلا أحكام، ونسب كل معلومة لمصدرها.
- جمل قصيرة صالحة للإلقاء الصوتي، والأرقام والتواريخ بصيغتها المنطوقة.
- تحديد: نوع المادة (خبر عاجل/تقرير/موجز)، المدة أو عدد الكلمات، الجمهور، ونبرة الإلقاء.`,
  },
  {
    id: "narrative",
    name: "نص سردي",
    icon: "📖",
    desc: "قصة أو مشهد أو حلقة سرد أدبي",
    platforms: ["ChatGPT / Claude / Gemini", "منصة مقام (الاستوديو الدرامي)"],
    primaryLang: "ar",
    expertise: `قواعد برومبت السرد المحترف:
- قوس قصصي واضح: وضع ابتدائي ← حدث قادح ← تصاعد ← ذروة ← حل.
- تحديد الراوي (عليم/متكلم/مخاطب) وصوته وإيقاعه، والزمن والمكان بحواسهما الخمس.
- «أظهر لا تخبر»: مطالبة صريحة بالتفاصيل الحسية والحوار الكاشف بدل التقرير.
- تحديد الطول، الجمهور، الحقبة واللهجة إن كانت الحوارات عامية.`,
  },
  {
    id: "image",
    name: "توليد صورة",
    icon: "🖼️",
    desc: "برومبت احترافي لمولدات الصور",
    platforms: ["Midjourney", "DALL·E / GPT-Image", "Nano Banana (Gemini)", "Stable Diffusion"],
    primaryLang: "en",
    expertise: `Professional image-prompt craft:
- Structure: main subject (specific, concrete) → action/pose → environment → composition and framing (close-up, wide, rule of thirds) → lighting (golden hour, rim light, soft studio) → lens/medium (85mm portrait, watercolor, cinematic still) → mood and color palette → quality tags.
- One idea per prompt; adjectives attached to their nouns; no contradictions.
- Provide a matching negative prompt (what to exclude: extra fingers, text, watermark, blur).
- Respect platform dialect: Midjourney parameters (--ar, --style) when targeted.`,
  },
  {
    id: "video",
    name: "توليد فيديو",
    icon: "🎬",
    desc: "برومبت مشهدي لمولدات الفيديو",
    platforms: ["Google Veo", "Sora", "Runway / Kling"],
    primaryLang: "en",
    expertise: `Professional video-prompt craft:
- Describe ONE continuous shot: subject and action with clear physics → camera movement (slow dolly-in, orbit, handheld tracking) → framing → lighting and time of day → environment details in motion (wind, dust, rain) → mood, color grade, film style.
- Specify duration feel and pacing; keep actions physically plausible for coherence.
- Audio cues if the platform supports them (ambient sound, dialogue line).
- Avoid scene cuts and multiple shots in one prompt unless the platform supports storyboards.`,
  },
  {
    id: "song",
    name: "توليد أغنية",
    icon: "🎼",
    desc: "برومبت موسيقي لمولدات الأغاني",
    platforms: ["منصة مقام", "Suno / Udio"],
    primaryLang: "en",
    expertise: `Professional music-prompt craft:
- Structure: genre and cultural style → mood → tempo (BPM) → key instruments → vocal type and language/dialect → song structure (intro, verse, chorus, bridge) → production quality tags.
- For Arabic music: name the maqam and its quarter tones, oriental instruments (oud, qanun, nay, mijwiz), and the rhythmic cycle (maqsum, dabke, samai).
- For منصة مقام: اكتب الفكرة والكلمات بالعربية واللهجة، ودع المنصة تبني البرومبت الموسيقي — البرومبت هنا هو فكرة الأغنية ومزاجها وبنيتها.
- Keep it one dense paragraph; engines dilute long rambling prompts.`,
  },
  {
    id: "podcast",
    name: "بودكاست",
    icon: "🎧",
    desc: "برومبت حلقة حوارية كاملة",
    platforms: ["ChatGPT / Claude / Gemini", "منصة مقام (البودكاست)"],
    primaryLang: "ar",
    expertise: `قواعد برومبت البودكاست المحترف:
- خطاف افتتاحي في أول ٣٠ ثانية، ثم خارطة حلقة: ٣-٥ فقرات بمنحنى تشويق.
- شخصيتا المقدمَين: أدوارهما (محاور/خبير)، كيمياء الحوار، ونسبة الكلام بينهما.
- مقاطعات طبيعية وأسئلة متابعة وأمثلة ملموسة — لا محاضرة متبادلة.
- تحديد المدة والجمهور واللهجة ونقاط الختام (خلاصة + دعوة لفعل).`,
  },
  {
    id: "ad",
    name: "إعلان تسويقي",
    icon: "📢",
    desc: "سكربت إعلان قصير يبيع فعلاً",
    platforms: ["ChatGPT / Claude / Gemini", "منصة مقام (تعليق صوتي)"],
    primaryLang: "ar",
    expertise: `قواعد برومبت الإعلان المحترف:
- الخطاف في أول ٣ ثوانٍ (سؤال، مفارقة، ألم يعرفه الجمهور).
- منفعة واحدة رئيسة لا قائمة مزايا، بلغة الجمهور لا لغة الشركة.
- بنية: خطاف ← مشكلة ← الحل بالمنتج ← إثبات ← دعوة لفعل واحدة واضحة.
- تحديد المدة بدقة (١٥/٣٠/٦٠ ثانية ≈ ٤٠/٨٠/١٦٠ كلمة) والقناة والنبرة.`,
  },
  {
    id: "voiceover",
    name: "تعليق صوتي",
    icon: "🎙️",
    desc: "نص تعليق جاهز للإلقاء الصوتي",
    platforms: ["ChatGPT / Claude / Gemini", "منصة مقام (النص إلى صوت)"],
    primaryLang: "ar",
    expertise: `قواعد برومبت التعليق الصوتي المحترف:
- الكتابة للأذن لا للعين: جمل قصيرة، لا تراكيب متداخلة، تكرار مقصود للمفاتيح.
- تحديد النبرة (وقور/دافئ/حماسي) والسرعة ومواضع الوقفات [وقفة].
- الأرقام والاختصارات بصيغتها المنطوقة، وعلامات الترقيم أدوات إيقاع.
- تحديد الاستخدام (وثائقي/شرح/كتاب صوتي) والجمهور والمدة بالكلمات.`,
  },
];

export type CraftedPrompt = {
  title: string;
  prompt: string;
  /** الترجمة المقابلة (عربي للإنجليزي وبالعكس) حين تفيد */
  promptAlt?: string;
  /** برومبت سلبي — للصور والفيديو */
  negativePrompt?: string;
  tips: string[];
};

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "اسم موجز للبرومبت بالعربية" },
    prompt: {
      type: "string",
      description: "البرومبت الجاهز للصق في المنصة المستهدفة — باللغة الأنسب لها",
    },
    promptAlt: {
      type: "string",
      description: "النسخة المقابلة: ترجمة عربية للبرومبت الإنجليزي (أو العكس) لفهم المستخدم — فارغة إن لم تفد",
    },
    negativePrompt: {
      type: "string",
      description: "البرومبت السلبي (ما يُستبعد) — للصور والفيديو فقط، وإلا فارغ",
    },
    tips: {
      type: "array",
      description: "٣ نصائح عملية قصيرة لتحسين النتيجة على هذه المنصة تحديداً",
      items: { type: "string" },
    },
  },
  required: ["title", "prompt", "tips"],
  propertyOrdering: ["title", "prompt", "promptAlt", "negativePrompt", "tips"],
};

export async function craftPrompt(
  apiKey: string,
  typeId: string,
  brief: string,
  platform?: string
): Promise<CraftedPrompt> {
  const type = PROMPT_TYPES.find((t) => t.id === typeId);
  if (!type) throw new Error("نوع برومبت غير معروف");

  const system = `أنت مهندس برومبتات محترف في منصة «مقام»، اختصاصك اليوم: ${type.name}.

عدّة الخبير التي تلتزم بها حرفياً:
${type.expertise}

مهمتك: حوّل طلب المستخدم إلى برومبت واحد جاهز للصق، مكتمل التفاصيل، بلا أسئلة رجوع — املأ الفراغات بقرارات احترافية ذكية من سياق الطلب.
${platform ? `المنصة المستهدفة: ${platform} — التزم بلهجتها وحدودها.` : `اختر الصياغة الأصلح لمنصات ${type.name} عموماً.`}
لغة البرومبت الرئيسة: ${type.primaryLang === "en" ? "الإنجليزية (مع ترجمة عربية في promptAlt ليفهم المستخدم ما سيرسله)" : "العربية"}.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: `طلب المستخدم:\n${brief}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 4096,
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
  if (!text) throw new Error("استجابة فارغة من المهندس");

  const data = JSON.parse(text) as CraftedPrompt;
  return {
    title: data.title,
    prompt: data.prompt,
    promptAlt: data.promptAlt || undefined,
    negativePrompt: data.negativePrompt || undefined,
    tips: Array.isArray(data.tips) ? data.tips.slice(0, 5) : [],
  };
}
