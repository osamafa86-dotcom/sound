export type Voice = {
  id: string;
  name: string;
  gender: "male" | "female";
  dialect: string;
  provider: "elevenlabs" | "azure";
  tone: string;
  /** معرّف الصوت الفعلي لدى ElevenLabs (أصوات جاهزة متاحة لكل الحسابات) */
  elevenVoiceId?: string;
};

/**
 * كتالوج الأصوات المعروض في الواجهة، مربوط بأصوات ElevenLabs الجاهزة.
 * نموذج multilingual ينطق العربية الفصحى بإتقان بأي من هذه الأصوات؛
 * اللهجات الحقيقية المتقنة تأتي لاحقاً من مكتبة أصوات ElevenLabs العربية ومن Azure.
 */
export const VOICES: Voice[] = [
  { id: "v-fusha-m1", name: "ماجد", gender: "male", dialect: "فصحى", provider: "elevenlabs", tone: "عميق وثابت — وثائقيات وإعلانات", elevenVoiceId: "onwK4e9ZLuTAKqWW03F9" },
  { id: "v-fusha-f1", name: "ليان", gender: "female", dialect: "فصحى", provider: "elevenlabs", tone: "واضح ودافئ — تعليم وسرد", elevenVoiceId: "EXAVITQu4vr4xnSDxMaL" },
  { id: "v-fusha-m2", name: "راوي", gender: "male", dialect: "فصحى", provider: "elevenlabs", tone: "سردي معبّر — كتب صوتية وقصص", elevenVoiceId: "nPczCjzI2devNBz1zQrb" },
  { id: "v-saudi-m1", name: "فهد", gender: "male", dialect: "سعودية", provider: "elevenlabs", tone: "شبابي قريب — محتوى تواصل اجتماعي", elevenVoiceId: "IKne3meq5aSn9XLyUdCD" },
  { id: "v-egy-f1", name: "سلمى", gender: "female", dialect: "مصرية", provider: "elevenlabs", tone: "حيوي وودود — إعلانات وترفيه", elevenVoiceId: "cgSgspJ2msm6clMCkdW9" },
  { id: "v-jor-m1", name: "عمر", gender: "male", dialect: "أردنية", provider: "elevenlabs", tone: "هادئ وواثق — بودكاست", elevenVoiceId: "JBFqnCBsd6RMkjVDRZzb" },
  { id: "v-pal-m1", name: "وسيم", gender: "male", dialect: "فلسطينية", provider: "elevenlabs", tone: "دافئ صادق — قصص ومحتوى اجتماعي", elevenVoiceId: "bIHbv24MWmeRgasZH58o" },
  { id: "v-pal-f1", name: "دارين", gender: "female", dialect: "فلسطينية", provider: "elevenlabs", tone: "حنون واضح — تعليم وسرد", elevenVoiceId: "XrExE9yKIg1WjnnlVkGX" },
  { id: "v-uae-f1", name: "موزة", gender: "female", dialect: "إماراتية", provider: "elevenlabs", tone: "رسمي أنيق — أخبار وشركات", elevenVoiceId: "Xb7hH8MSUJpSbSDYk0k2" },
  { id: "v-leb-f1", name: "ريما", gender: "female", dialect: "لبنانية", provider: "elevenlabs", tone: "ناعم عصري — إعلانات ولايف ستايل", elevenVoiceId: "pFZP5JQG7iQjIQuC4Bku" },
];

export const DIALECTS = [...new Set(VOICES.map((v) => v.dialect))];
