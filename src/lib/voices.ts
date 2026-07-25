export type Voice = {
  id: string;
  name: string;
  gender: "male" | "female";
  dialect: string;
  provider: "elevenlabs" | "azure";
  tone: string;
};

/**
 * كتالوج الأصوات المعروض في الواجهة.
 * في وضع التشغيل الفعلي تُجلب القوائم من ElevenLabs وAzure وتُطابق بالمعرّفات الحقيقية.
 */
export const VOICES: Voice[] = [
  { id: "v-fusha-m1", name: "ماجد", gender: "male", dialect: "فصحى", provider: "elevenlabs", tone: "عميق وثابت — وثائقيات وإعلانات" },
  { id: "v-fusha-f1", name: "ليان", gender: "female", dialect: "فصحى", provider: "elevenlabs", tone: "واضح ودافئ — تعليم وسرد" },
  { id: "v-fusha-m2", name: "راوي", gender: "male", dialect: "فصحى", provider: "elevenlabs", tone: "سردي معبّر — كتب صوتية وقصص" },
  { id: "v-saudi-m1", name: "فهد", gender: "male", dialect: "سعودية", provider: "azure", tone: "شبابي قريب — محتوى تواصل اجتماعي" },
  { id: "v-egy-f1", name: "سلمى", gender: "female", dialect: "مصرية", provider: "azure", tone: "حيوي وودود — إعلانات وترفيه" },
  { id: "v-jor-m1", name: "عمر", gender: "male", dialect: "أردنية", provider: "azure", tone: "هادئ وواثق — بودكاست" },
  { id: "v-uae-f1", name: "موزة", gender: "female", dialect: "إماراتية", provider: "azure", tone: "رسمي أنيق — أخبار وشركات" },
  { id: "v-leb-f1", name: "ريما", gender: "female", dialect: "لبنانية", provider: "azure", tone: "ناعم عصري — إعلانات ولايف ستايل" },
];

export const DIALECTS = [...new Set(VOICES.map((v) => v.dialect))];
