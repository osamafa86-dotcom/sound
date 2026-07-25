export type Voice = {
  id: string;
  name: string;
  gender: "male" | "female";
  dialect: string;
  provider: "elevenlabs" | "azure";
  tone: string;
  /** معرّف الصوت الفعلي لدى ElevenLabs */
  elevenVoiceId?: string;
};

/**
 * كتالوج الأصوات — كلها أصوات عربية أصلية (متحدثون أصليون) من مكتبة ElevenLabs المشتركة،
 * وليست أصواتاً إنجليزية تنطق العربية بلكنة. مرتبة بحيث تأتي اللهجات الشامية أولاً.
 *
 * ملاحظة: اللهجة تأتي من الصوت ومن النص معاً — اكتب بالعامية ليخرج النطق عامياً.
 */
export const VOICES: Voice[] = [
  // فلسطينية
  { id: "v-pal-m1", name: "عدي", gender: "male", dialect: "فلسطينية", provider: "elevenlabs", tone: "معبّر واحترافي — سرد ومحتوى راقٍ", elevenVoiceId: "8sSDN08XkFeN2zqNwCZk" },
  { id: "v-pal-m2", name: "خالد", gender: "male", dialect: "فلسطينية", provider: "elevenlabs", tone: "عميق وقوي — وثائقيات وإعلانات", elevenVoiceId: "drMurExmkWVIH5nW8snR" },

  // أردنية (شامية — الأقرب للفلسطينية)
  { id: "v-jor-f1", name: "فرح", gender: "female", dialect: "أردنية", provider: "elevenlabs", tone: "دافئ وعفوي — الأكثر استخداماً عربياً", elevenVoiceId: "4wf10lgibMnboGJGCLrP" },
  { id: "v-jor-m1", name: "بلال", gender: "male", dialect: "أردنية", provider: "elevenlabs", tone: "عميق وواثق — تواصل اجتماعي", elevenVoiceId: "jN2L0WufWIAXnexEWTfh" },

  // شامية عامة
  { id: "v-lev-f1", name: "سلمى", gender: "female", dialect: "شامية", provider: "elevenlabs", tone: "واضح ومهني — تعليم وشركات", elevenVoiceId: "a1KZUXKFVFDOb33I1uqr" },
  { id: "v-lev-m1", name: "رامي", gender: "male", dialect: "شامية", provider: "elevenlabs", tone: "ودود وقريب — بودكاست", elevenVoiceId: "Ughw9ouHSYmmbRa0am9u" },
  { id: "v-lev-f2", name: "ليلى الشامية", gender: "female", dialect: "شامية", provider: "elevenlabs", tone: "ناعم ودافئ — لايف ستايل", elevenVoiceId: "hxVLXZtpLMZepthqBUI4" },

  // سورية
  { id: "v-syr-f1", name: "غيداء", gender: "female", dialect: "سورية", provider: "elevenlabs", tone: "رقيق وجذاب — سرد وقصص", elevenVoiceId: "Wim44P0dU9HtjyzNnFsv" },
  { id: "v-syr-m1", name: "يزن", gender: "male", dialect: "سورية", provider: "elevenlabs", tone: "هادئ ومتزن — تعليق صوتي", elevenVoiceId: "pIPrJAPlpTZzoh1Pzjgr" },

  // لبنانية
  { id: "v-leb-m1", name: "فادي", gender: "male", dialect: "لبنانية", provider: "elevenlabs", tone: "واثق ومحاوِر — إعلانات", elevenVoiceId: "oJQlz7pz2yWd7MRmDUXm" },

  // فصحى
  { id: "v-fusha-m1", name: "عمر", gender: "male", dialect: "فصحى", provider: "elevenlabs", tone: "فخم وآمِر — وثائقيات ومقدمات", elevenVoiceId: "apsZFlSToM2vmFpwz5jX" },
  { id: "v-fusha-f1", name: "ليلى", gender: "female", dialect: "فصحى", provider: "elevenlabs", tone: "أنيق وواضح النطق — سرد رسمي", elevenVoiceId: "RaelJk8tltOJ5KMrKjDu" },
  { id: "v-fusha-f2", name: "نادية", gender: "female", dialect: "فصحى", provider: "elevenlabs", tone: "دافئ ومعبّر — كتب صوتية", elevenVoiceId: "neuupZMh7HITtzzrdJ0N" },
  { id: "v-fusha-m2", name: "مصطفى", gender: "male", dialect: "فصحى", provider: "elevenlabs", tone: "واضح وواثق — تعليم وشروحات", elevenVoiceId: "1x4qqNd64EByFYOAmcR2" },
  { id: "v-fusha-m3", name: "طارق", gender: "male", dialect: "فصحى", provider: "elevenlabs", tone: "رنّان ومطمئن — أخبار", elevenVoiceId: "18HMWpalD7cscJTD8lEY" },

  // مصرية
  { id: "v-egy-f1", name: "فاطمة", gender: "female", dialect: "مصرية", provider: "elevenlabs", tone: "حيوي ومعبّر — ترفيه وإعلانات", elevenVoiceId: "I3u6waC588j43py1kDN2" },
  { id: "v-egy-m1", name: "حازم", gender: "male", dialect: "مصرية", provider: "elevenlabs", tone: "واثق كمذيع أخبار — تلفزيون", elevenVoiceId: "BEK0cM5ocuhluB2yKvMa" },
  { id: "v-egy-m2", name: "فتّاح", gender: "male", dialect: "مصرية", provider: "elevenlabs", tone: "عميق — سرد وحكايات", elevenVoiceId: "UDyuvKjPXutvqdCvJ0Oh" },

  // سعودية وخليجية
  { id: "v-sau-f1", name: "مريم", gender: "female", dialect: "سعودية", provider: "elevenlabs", tone: "هادئ ودافئ — محادثات وخدمة", elevenVoiceId: "aMmeBf0lzDYlouyfqNjh" },
  { id: "v-sau-m1", name: "أحمد", gender: "male", dialect: "سعودية", provider: "elevenlabs", tone: "واثق ومحاوِر — بودكاست", elevenVoiceId: "jUwEniiVp6drT0jac8vD" },
  { id: "v-gulf-m1", name: "يوسف", gender: "male", dialect: "خليجية", provider: "elevenlabs", tone: "سينمائي مهيب — وثائقيات", elevenVoiceId: "WcswLmU3iGeMrhxfWXKN" },
  { id: "v-omn-m1", name: "علي", gender: "male", dialect: "عُمانية", provider: "elevenlabs", tone: "هادئ وواضح — محادثات", elevenVoiceId: "ru5xIfU6L5uUJi5V0843" },
];

export const DIALECTS = [...new Set(VOICES.map((v) => v.dialect))];
