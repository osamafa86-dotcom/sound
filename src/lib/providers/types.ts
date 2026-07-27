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
};

export type MusicRequest = {
  lyrics?: string;
  maqamId: string;
  styleId: string;
  instrumentIds: string[];
  /** برومبت الأسلوب النهائي المبني بواسطة طبقة الذكاء الاصطناعي الوسيطة */
  stylePrompt: string;
  durationSec?: number;
};

export type AudioResult = {
  audio: Buffer;
  mimeType: string;
  provider: string;
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
