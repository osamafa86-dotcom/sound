/**
 * مكتبة أساليب الأداء — قلب المحرك التعبيري.
 *
 * كل أسلوب = حزمة كاملة: وسوم أداء تُحقن في النص (يفهمها الجيل الثالث
 * من محرك ElevenLabs حتى داخل النص العربي) + إعدادات صوت مضبوطة له.
 * و«التلقائي» يحلل النص عبر Gemini ويختار الأسلوب بنفسه.
 */

export type StyleCategory = "مشاعر" | "مهني" | "سرد" | "إعلان" | "فلسطيني" | "مشاهد";

export type PerformanceStyle = {
  id: string;
  name: string;
  icon: string;
  desc: string;
  category: StyleCategory;
  /** وسوم v3 تُحقن في بداية النص (بالإنجليزية — المحرك يفهمها وسط العربية) */
  tags: string[];
  /** ثبات v3: 0 مبدع | 0.5 طبيعي | 1 رصين */
  stability: 0 | 0.5 | 1;
};

export const PERFORMANCE_STYLES: PerformanceStyle[] = [
  // مهني
  {
    id: "news",
    name: "مذيع الأخبار",
    icon: "📰",
    desc: "صوت إذاعي واضح وموثوق ومحايد بمصداقية عالية",
    category: "مهني",
    tags: ["professional news anchor tone", "clear measured delivery"],
    stability: 1,
  },
  {
    id: "documentary",
    name: "وثائقي مهيب",
    icon: "🎞️",
    desc: "فخم وعميق بإيقاع متأنٍ يليق بالوثائقيات",
    category: "مهني",
    tags: ["deep authoritative documentary narration", "slow deliberate pacing"],
    stability: 1,
  },
  {
    id: "educational",
    name: "تعليمي واضح",
    icon: "🎓",
    desc: "ودود ومشجع بإيقاع مريح يجعل التعلم ممتعاً",
    category: "مهني",
    tags: ["warm friendly teacher tone", "clear patient pacing"],
    stability: 0.5,
  },
  {
    id: "corporate",
    name: "عروض تقديمية",
    icon: "💼",
    desc: "مهني واثق بحضور قوي للعروض المؤسسية",
    category: "مهني",
    tags: ["confident professional presenter", "polished corporate tone"],
    stability: 1,
  },
  // سرد
  {
    id: "storyteller",
    name: "راوي القصص",
    icon: "📖",
    desc: "جذاب ومعبّر يجسد الشخصيات ويحيي الأحداث",
    category: "سرد",
    tags: ["expressive storyteller", "dramatic engaging narration"],
    stability: 0.5,
  },
  {
    id: "audiobook",
    name: "كتاب صوتي",
    icon: "📚",
    desc: "دافئ ومتزن لساعات استماع مريحة",
    category: "سرد",
    tags: ["warm audiobook narration", "steady comfortable rhythm"],
    stability: 0.5,
  },
  {
    id: "whisper",
    name: "هامس حميم",
    icon: "🤫",
    desc: "همس قريب هادئ للتأمل والمحتوى الحميم",
    category: "سرد",
    tags: ["whispering", "soft intimate ASMR-like delivery"],
    stability: 0,
  },
  {
    id: "devotional",
    name: "خاشع وقور",
    icon: "🕌",
    desc: "روحاني مهيب بسكينة ووقار للمحتوى الديني",
    category: "سرد",
    tags: ["reverent solemn devotional tone", "serene measured delivery"],
    stability: 1,
  },
  // إعلان
  {
    id: "promo",
    name: "إعلاني متحمس",
    icon: "📢",
    desc: "طاقة عالية وسرعة وحماس يشعل الانتباه",
    category: "إعلان",
    tags: ["excited", "high-energy commercial voiceover"],
    stability: 0,
  },
  {
    id: "luxury",
    name: "فاخر أنيق",
    icon: "✨",
    desc: "رقي وهدوء واثق لعلامات الرفاهية",
    category: "إعلان",
    tags: ["smooth elegant luxury brand voice", "calm confident allure"],
    stability: 0.5,
  },
  // مشاعر
  {
    id: "joyful",
    name: "الفرح المشرق",
    icon: "😄",
    desc: "مشرق ومبتهج يملؤه السعادة والحيوية",
    category: "مشاعر",
    tags: ["happily", "cheerful bright energy"],
    stability: 0,
  },
  {
    id: "deep-sadness",
    name: "الحزن العميق",
    icon: "😢",
    desc: "مثقل ومكسور القلب بوقفات ملحوظة ونبرة خافتة",
    category: "مشاعر",
    tags: ["sad", "heavy somber tone with mournful pauses"],
    stability: 0,
  },
  {
    id: "calm-anger",
    name: "الغضب الهادئ",
    icon: "😤",
    desc: "نبرة منخفضة مسيطرة بحدة باردة تعكس غضباً محكوماً",
    category: "مشاعر",
    tags: ["angry", "cold controlled fury, low intense tone"],
    stability: 0.5,
  },
  {
    id: "fear",
    name: "الخوف والتوتر",
    icon: "😨",
    desc: "مذعور لاهث بوتيرة محمومة وارتجاف خفيف",
    category: "مشاعر",
    tags: ["fearful trembling voice", "breathless anxious pacing"],
    stability: 0,
  },
  {
    id: "wonder",
    name: "المفاجأة والدهشة",
    icon: "😮",
    desc: "لاهث بذهول ودهشة وتنويع واسع في الطبقة",
    category: "مشاعر",
    tags: ["surprised", "awed wide-eyed wonder"],
    stability: 0,
  },
  {
    id: "sarcastic",
    name: "ساخر متهكم",
    icon: "😏",
    desc: "نبرة متعالية ساخرة بانعطافات مبالغ فيها ولمسة تهكم",
    category: "مشاعر",
    tags: ["sarcastic mocking tone", "dry ironic delivery"],
    stability: 0,
  },
  {
    id: "hopeful",
    name: "الأمل الملهم",
    icon: "🌅",
    desc: "متصاعد مليء بالتفاؤل ينتهي بنبرة مشرقة",
    category: "مشاعر",
    tags: ["inspiring hopeful tone", "rising optimistic energy"],
    stability: 0.5,
  },
  // فلسطيني — لهجات فرعية أصيلة، امتداد ذاكرة التراث الفلسطيني في المنصة
  {
    id: "ps-fallahi",
    name: "فلاحية ريفية",
    icon: "🌾",
    desc: "لهجة الريف الفلسطيني الدافئة — كاف مكشكشة وقاف صريحة وطيبة أهل الأرض",
    category: "فلسطيني",
    tags: [
      "rural Palestinian fallahi village accent with hard emphatic qaf",
      "warm earthy hospitable countryside delivery",
    ],
    stability: 0.5,
  },
  {
    id: "ps-madani",
    name: "مدنية شامية",
    icon: "🏙️",
    desc: "لهجة مدن القدس ويافا وحيفا — قاف مهموزة ونعومة حضرية راقية",
    category: "فلسطيني",
    tags: [
      "urban Palestinian madani city accent, qaf pronounced as glottal stop",
      "refined soft Levantine urban delivery",
    ],
    stability: 0.5,
  },
  {
    id: "ps-nabulsi",
    name: "نابلسية",
    icon: "🏛️",
    desc: "لهجة جبل النار — إيقاع نابلسي مميز بمدّات عريضة ونبرة تجارية ودودة",
    category: "فلسطيني",
    tags: [
      "Nablus Palestinian accent with distinctive elongated vowels",
      "friendly confident merchant-town cadence",
    ],
    stability: 0.5,
  },
  {
    id: "ps-ghazzawi",
    name: "غزاوية",
    icon: "🌊",
    desc: "لهجة غزة الساحلية — حدة بحرية صامدة بملامح قريبة من المصري",
    category: "فلسطيني",
    tags: [
      "Gaza Palestinian coastal accent with slight Egyptian influence",
      "resilient spirited seaside delivery",
    ],
    stability: 0.5,
  },
  // مشاهد جاهزة — «المستوى السينمائي»: كل مشهد إخراج كامل بضغطة واحدة
  {
    id: "secret-whisper",
    name: "همس الأسرار",
    icon: "🤫",
    desc: "همس قريب خطير كأنك تفشي سراً لا يجب أن يُسمع",
    category: "مشاهد",
    tags: ["whispering", "very close dramatic quiet whisper, telling a dangerous secret"],
    stability: 0,
  },
  {
    id: "horror",
    name: "الرعب المطلق",
    icon: "😱",
    desc: "صوت مرتجف وتنفس ثقيل — ذعر حقيقي يتسلل للمستمع",
    category: "مشاهد",
    tags: ["terrified", "voice shaking with pure terror, breathing heavily"],
    stability: 0,
  },
  {
    id: "breaking-news",
    name: "خبر عاجل",
    icon: "🚨",
    desc: "إيقاع سريع جاد وملحّ — نشرة اللحظات الحرجة",
    category: "مشاهد",
    tags: ["fast urgent serious breaking-news anchor tone"],
    stability: 0.5,
  },
  {
    id: "romantic",
    name: "الرومانسي",
    icon: "❤️",
    desc: "ناعم حنون دافئ — كلام من القلب إلى القلب",
    category: "مشاهد",
    tags: ["very soft tender romantic loving tone"],
    stability: 0,
  },
  {
    id: "robot",
    name: "الروبوت",
    icon: "🤖",
    desc: "مسطّح آلي دقيق بلا مشاعر — أنظمة وتقنية",
    category: "مشاهد",
    tags: ["flat emotionless mechanical precise robotic voice"],
    stability: 1,
  },
  {
    id: "movie-trailer",
    name: "تريلر سينمائي",
    icon: "🎬",
    desc: "عميق ملحمي درامي — «في عالمٍ تحكمه الفوضى...»",
    category: "مشاهد",
    tags: ["very deep gritty epic dramatic movie-trailer voiceover"],
    stability: 0.5,
  },
  {
    id: "airport-call",
    name: "نداء المطار",
    icon: "✈️",
    desc: "رسمي واضح مرتفع بصدى خفيف — إعلانات المرافق العامة",
    category: "مشاهد",
    tags: ["loud clear formal public announcement with slight echo"],
    stability: 1,
  },
  {
    id: "royal-arrogance",
    name: "الغرور الملكي",
    icon: "👑",
    desc: "متعالٍ متباهٍ أرستقراطي — شخصيات الملوك والأشرار",
    category: "مشاهد",
    tags: ["arrogant boastful upper-class aristocratic tone"],
    stability: 0.5,
  },
  {
    id: "childlike",
    name: "براءة الأطفال",
    icon: "🧸",
    desc: "طبقة عالية بريئة حلوة — شخصيات كرتونية وقصص",
    category: "مشاهد",
    tags: ["high-pitched innocent sweet childlike voice"],
    stability: 0,
  },
  {
    id: "sleepy-story",
    name: "قصص ما قبل النوم",
    icon: "🥱",
    desc: "بطيء ناعس مهدّئ بتثاؤب خفيف — ينوّم الصغار",
    category: "مشاهد",
    tags: ["very slow sleepy soothing bedtime voice, yawning slightly"],
    stability: 0,
  },
  {
    id: "motivational",
    name: "خطاب تحفيزي",
    icon: "🚀",
    desc: "قوي ملهم قيادي — ينهض بالهمم من الصفر",
    category: "مشاهد",
    tags: ["powerful inspiring motivational speech tone"],
    stability: 0.5,
  },
  {
    id: "holding-tears",
    name: "مغالبة الدموع",
    icon: "🥺",
    desc: "صوت يتشقق ويحاول ألا يبكي — الشجاعة المكسورة",
    category: "مشاهد",
    tags: ["voice cracking and wavering, desperately trying not to cry, swallowing hard, trying to sound brave"],
    stability: 0,
  },
  {
    id: "sweet-anger",
    name: "غضب بابتسامة",
    icon: "😬",
    desc: "لطف مصطنع يخفي غضباً عميقاً — العدوانية السلبية",
    category: "مشاهد",
    tags: ["sickly sweet overly polite tone poorly masking deep anger, smiling through gritted teeth"],
    stability: 0.5,
  },
  {
    id: "great-relief",
    name: "تنهيدة الراحة",
    icon: "😌",
    desc: "يبدأ بتنهيدة عميقة — نجونا أخيراً",
    category: "مشاهد",
    tags: ["tone of immense relief, starting with a big sigh"],
    stability: 0,
  },
];

export const STYLE_CATEGORIES: StyleCategory[] = [
  "مشاهد",
  "مهني",
  "سرد",
  "إعلان",
  "مشاعر",
  "فلسطيني",
];

/**
 * طبقات الأداء — قاعدة «الطبقات» الاحترافية: تتراكب فوق الأسلوب الأساسي
 * (مشهد + حالة جسدية + بيئة صوتية معاً) فتتركب وسومها في بادئة واحدة.
 */
export type StyleLayer = {
  id: string;
  name: string;
  icon: string;
  category: "جسدي" | "بيئة";
  tags: string[];
};

export const STYLE_LAYERS: StyleLayer[] = [
  // جسدي — «التوجيه الجسدي»: الجسد المتخيَّل ينعكس على الحبال الصوتية
  { id: "shivering", name: "يرتجف من البرد", icon: "🥶", category: "جسدي", tags: ["speaking with chattering teeth, shivering uncontrollably from freezing cold, trembling tight voice"] },
  { id: "out-of-breath", name: "يلهث بعد ركض", icon: "🏃", category: "جسدي", tags: ["completely exhausted and out of breath, panting between words"] },
  { id: "heavy-lifting", name: "يرفع شيئاً ثقيلاً", icon: "🏋️", category: "جسدي", tags: ["straining with heavy physical effort, grunting and pausing to push"] },
  { id: "mouth-full", name: "فمه ممتلئ", icon: "🍔", category: "جسدي", tags: ["speaking with mouth completely full of food, chewing, slightly muffled and informal"] },
  { id: "drowsy", name: "نصف نائم", icon: "😪", category: "جسدي", tags: ["drowsy and half asleep, slow heavy dozing voice"] },
  // بيئة — هندسة المكان والتشوهات: العيوب تصنع الواقعية
  { id: "old-radio", name: "راديو قديم", icon: "📻", category: "بيئة", tags: ["broadcasting over a 1940s vintage radio, slightly muffled old-timey announcer cadence"] },
  { id: "phone-call", name: "مكالمة هاتفية", icon: "☎️", category: "بيئة", tags: ["voice heard through a telephone line, narrow compressed sound"] },
  { id: "megaphone", name: "عبر مكبّر صوت", icon: "📢", category: "بيئة", tags: ["shouting through a megaphone public address system"] },
  { id: "echo-hall", name: "صدى قاعة كبيرة", icon: "🏛️", category: "بيئة", tags: ["speaking in a large empty hall with strong echo and reverb"] },
  { id: "clipped-mic", name: "ميكروفون متشبع", icon: "🎤", category: "بيئة", tags: ["screaming so loudly the microphone peaks and clips, raw audio distortion"] },
];

export const LAYER_CATEGORIES: { id: StyleLayer["category"]; name: string; icon: string }[] = [
  { id: "جسدي", name: "حالة جسدية", icon: "🏃" },
  { id: "بيئة", name: "بيئة صوتية", icon: "📻" },
];

export function getLayers(ids: string[]): StyleLayer[] {
  return ids
    .map((id) => STYLE_LAYERS.find((l) => l.id === id))
    .filter((l): l is StyleLayer => !!l);
}

/** وسوم الطبقات المختارة — كل وسم بين قوسين جاهزاً للحقن */
export function layerTagPrefix(ids: string[]): string {
  return getLayers(ids)
    .flatMap((l) => l.tags)
    .map((t) => `[${t}]`)
    .join(" ");
}

export function getStyle(id?: string): PerformanceStyle | null {
  return PERFORMANCE_STYLES.find((s) => s.id === id) ?? null;
}

/** تركيب بادئة الوسوم لأسلوب — تُحقن قبل النص */
export function styleTagPrefix(style: PerformanceStyle): string {
  return style.tags.map((t) => `[${t}]`).join(" ");
}

const CLASSIFY_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

/** «الاختيار التلقائي»: تحليل النص واختيار الأسلوب الأنسب — يعيد null عند التعذر */
export async function classifyStyle(apiKey: string, text: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${CLASSIFY_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `اختر أنسب أسلوب أداء صوتي لهذا النص من القائمة (أعد id فقط):
${PERFORMANCE_STYLES.map((s) => `- ${s.id}: ${s.name} (${s.desc})`).join("\n")}

النص:
"""${text.slice(0, 800)}"""`,
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                styleId: { type: "string", enum: PERFORMANCE_STYLES.map((s) => s.id) },
              },
              required: ["styleId"],
            },
            temperature: 0.1,
            maxOutputTokens: 128,
          },
        }),
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const text2 = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text2) return null;
    const data = JSON.parse(text2) as { styleId: string };
    return PERFORMANCE_STYLES.some((s) => s.id === data.styleId) ? data.styleId : null;
  } catch {
    return null;
  }
}
