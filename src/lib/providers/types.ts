import type { SongSection } from "@/lib/songSections";

/**
 * طبقة تجريد المزوّدين — كل خدمة ذكاء اصطناعي (ElevenLabs, Azure, Lyria, Suno...)
 * تُنفَّذ كوحدة مستقلة تحقق هذه الواجهات، فيسهل التبديل والإضافة دون تغيير بقية النظام.
 */

export type TTSRequest = {
  text: string;
  voiceId: string;
  /** معرّف صوت ElevenLabs مباشر — للأصوات المستنسخة غير الموجودة في الكتالوج */
  elevenVoiceId?: string;
  /** 0..1 — ثبات الأداء مقابل التعبير العاطفي */
  stability?: number;
  /** سرعة النطق (1 = طبيعي) */
  speed?: number;
  format?: "mp3" | "wav";
  /** المحرك التعبيري (الجيل الثالث): وسوم مشاعر وأفعال داخل النص */
  expressive?: boolean;
  /** بادئة وسوم أسلوب الأداء — تُحقن قبل النص */
  stylePrefix?: string;
  /** قوة التعبير لمحرك الجيل الثاني (style exaggeration 0..1) */
  liveliness?: number;
  /** تعزيز حضور الصوت وقربه */
  speakerBoost?: boolean;
};

export type MusicRequest = {
  lyrics?: string;
  maqamId: string;
  styleId: string;
  instrumentIds: string[];
  /** برومبت الأسلوب النهائي المبني بواسطة طبقة الذكاء الاصطناعي الوسيطة */
  stylePrompt: string;
  durationSec?: number;
  /** مقاطع مُهيكلة — تُترجم لخطة تأليف لدى المحركات الداعمة (Eleven Music) */
  sections?: SongSection[];
  /** جنس صوت الغناء المطلوب */
  singer?: "male" | "female";
  /** سرعة الإيقاع (نبضة/دقيقة) */
  bpm?: number;
  /** لهجة الأداء الغنائي بالإنجليزية (مثل Palestinian) — لنطق أصيل باللهجة */
  dialectEn?: string;
  /** إعادة توليد مقطع بعينه: فهرس المقطع المستهدف والمقاطع الأخرى تُستورد من الأصل */
  regenerateIndex?: number;
  /** معرّف الأغنية الأصلية لدى المحرك — مصدر الاستيراد عند إعادة التوليد الجزئي */
  sourceSongId?: string;
  /** يُكتب بعد اكتمال المهمة: معرّف الناتج لدى المحرك ليُعاد التوليد الجزئي منه لاحقاً */
  elevenSongId?: string;
  /** سلالة برومبت المقام المستخدمة — ليُنسب لها التقييم الآلي (التطور الذاتي) */
  variantId?: number;
  /** فرض محرك بعينه — وضع المقارنة يولّد النسخة نفسها من المحركين معاً */
  forceProvider?: "lyria" | "eleven-music";
};

export type AudioResult = {
  audio: Buffer;
  mimeType: string;
  provider: string;
  /** معرّف الناتج لدى المحرك (Eleven Music) — يفتح إعادة التوليد الجزئي */
  providerSongId?: string;
  /** true عندما يكون الناتج من الوضع التجريبي وليس من محرك فعلي */
  mock?: boolean;
  /** معرّف المزوّد المفضّل الذي تعذّر، عند الرجوع إلى مزوّد بديل */
  fallbackFrom?: string;
  /** سبب تعذّر المزوّد المفضّل */
  fallbackReason?: string;
};

export interface TTSProvider {
  readonly id: string;
  synthesize(req: TTSRequest): Promise<AudioResult>;
}

export interface MusicProvider {
  readonly id: string;
  generate(req: MusicRequest): Promise<AudioResult>;
}
