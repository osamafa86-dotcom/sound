export type Voice = {
  id: string;
  name: string;
  gender: "male" | "female";
  dialect: string;
  provider: "elevenlabs" | "azure";
  tone: string;
  /** معرّف الصوت الفعلي لدى ElevenLabs (أصوات جاهزة متاحة لكل الحسابات) */
  elevenVoiceId?: string;
  /** اسم الصوت لدى Azure Speech (أصوات Neural باللهجات العربية) */
  azureVoiceName?: string;
  /** لغة SSML لصوت Azure (مثل ar-SA) */
  azureLocale?: string;
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
  { id: "v-uae-f1", name: "موزة", gender: "female", dialect: "إماراتية", provider: "elevenlabs", tone: "رسمي أنيق — أخبار وشركات", elevenVoiceId: "Xb7hH8MSUJpSbSDYk0k2" },
  { id: "v-leb-f1", name: "ريما", gender: "female", dialect: "لبنانية", provider: "elevenlabs", tone: "ناعم عصري — إعلانات ولايف ستايل", elevenVoiceId: "pFZP5JQG7iQjIQuC4Bku" },
  // أصوات Azure Neural — لهجات عربية أصيلة، تظهر عند ضبط AZURE_SPEECH_KEY
  { id: "az-sa-m1", name: "حامد", gender: "male", dialect: "سعودية", provider: "azure", tone: "لهجة سعودية أصيلة — أخبار وتقديم", azureVoiceName: "ar-SA-HamedNeural", azureLocale: "ar-SA" },
  { id: "az-sa-f1", name: "زارية", gender: "female", dialect: "سعودية", provider: "azure", tone: "لهجة سعودية أصيلة — سرد ودافئ", azureVoiceName: "ar-SA-ZariyahNeural", azureLocale: "ar-SA" },
  { id: "az-eg-m1", name: "شاكر", gender: "male", dialect: "مصرية", provider: "azure", tone: "لهجة مصرية أصيلة — حيوي وقريب", azureVoiceName: "ar-EG-ShakirNeural", azureLocale: "ar-EG" },
  { id: "az-eg-f1", name: "سلمى", gender: "female", dialect: "مصرية", provider: "azure", tone: "لهجة مصرية أصيلة — إعلانات وترفيه", azureVoiceName: "ar-EG-SalmaNeural", azureLocale: "ar-EG" },
  { id: "az-ae-f1", name: "فاطمة", gender: "female", dialect: "إماراتية", provider: "azure", tone: "لهجة إماراتية أصيلة — رسمي أنيق", azureVoiceName: "ar-AE-FatimaNeural", azureLocale: "ar-AE" },
  { id: "az-jo-m1", name: "تيم", gender: "male", dialect: "أردنية", provider: "azure", tone: "لهجة أردنية أصيلة — هادئ وواثق", azureVoiceName: "ar-JO-TaimNeural", azureLocale: "ar-JO" },
  { id: "az-iq-m1", name: "باسل", gender: "male", dialect: "عراقية", provider: "azure", tone: "لهجة عراقية أصيلة — عميق ومؤثر", azureVoiceName: "ar-IQ-BasselNeural", azureLocale: "ar-IQ" },
  { id: "az-ma-m1", name: "جمال", gender: "male", dialect: "مغربية", provider: "azure", tone: "لهجة مغربية أصيلة — سرد وتقديم", azureVoiceName: "ar-MA-JamalNeural", azureLocale: "ar-MA" },
];

export const DIALECTS = [...new Set(VOICES.map((v) => v.dialect))];
