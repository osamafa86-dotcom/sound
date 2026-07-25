/**
 * مساعد الكلمات والمقامات — طبقة تجريد مماثلة لمزوّدي الصوت:
 * التنفيذ الفعلي عبر Claude API، مع بديل تجريبي إرشادي يعمل بدون مفتاح.
 */

export type AssistMode = "write" | "improve";

export type AssistRequest = {
  mode: AssistMode;
  /** فكرة الأغنية (مطلوبة في وضع الكتابة) */
  idea?: string;
  /** الكلمات الحالية (مطلوبة في وضع التحسين) */
  lyrics?: string;
  /** معرّف اللهجة من DIALECTS */
  dialectId: string;
  /** الأسلوب الغنائي المختار من SONG_STYLES */
  styleId: string;
};

export type AssistResult = {
  title: string;
  lyrics: string;
  maqamId: string;
  /** تعليل اقتراح المقام بالعربية */
  maqamReason: string;
  /** البرومبت الموسيقي الاحترافي بالإنجليزية لمحركات التوليد */
  stylePromptEn: string;
  provider: string;
  /** true عندما يكون الناتج من الوضع التجريبي وليس من Claude فعلياً */
  mock?: boolean;
};

export interface LyricsAssistant {
  readonly id: string;
  assist(req: AssistRequest): Promise<AssistResult>;
}
