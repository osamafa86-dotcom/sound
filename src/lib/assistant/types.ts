import type { SongSection } from "@/lib/songSections";

/**
 * مساعد الكلمات والمقامات — طبقة تجريد مماثلة لمزوّدي الصوت:
 * التنفيذ الفعلي عبر Claude API، مع بديل تجريبي إرشادي يعمل بدون مفتاح.
 */

export type AssistMode = "write" | "improve" | "plan";

/**
 * خطة التلحين الكاملة في الوضع الذكي — المساعد يقررها بنفسه:
 * اللون الغنائي وجنس الصوت واللهجة والآلات والسرعة، بتعليل واحد موجه للمستخدم.
 */
export type MusicPlan = {
  styleId: string;
  singer: "male" | "female";
  dialectId: string;
  instrumentIds: string[];
  /** null = تُترك لتقدير المحرك */
  bpm: number | null;
  reason: string;
};

/** برومبت موسيقي سابق نال أعلى تقييم من المستخدمين — يُحقن كمثال يحتذي به المساعد */
export type StyleExemplar = {
  maqamId: string | null;
  stylePrompt: string;
};

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
  /** قالب الكتابة الشعرية من LYRIC_FORMS (دلعونا/عتابا/حداية...) — يتقدم على الأسلوب */
  formId?: string;
  /** الوضع الذكي: المساعد يقرر الخطة الموسيقية كاملة (لهجة ولون وصوت وآلات وسرعة) */
  auto?: boolean;
  /** أمثلة ناجحة من عقل المنصة (اختيارية) */
  exemplars?: StyleExemplar[];
};

export type AssistResult = {
  title: string;
  lyrics: string;
  maqamId: string;
  /** تعليل اقتراح المقام بالعربية */
  maqamReason: string;
  /** البرومبت الموسيقي الاحترافي بالإنجليزية لمحركات التوليد */
  stylePromptEn: string;
  /** الكلمات مقسّمة مقاطع مُهيكلة — تغذي محرر البنية وخطة التأليف */
  sections?: SongSection[];
  /** خطة التلحين الكاملة — تُرجَع في الوضع الذكي فقط */
  plan?: MusicPlan;
  provider: string;
  /** true عندما يكون الناتج من الوضع التجريبي وليس من Claude فعلياً */
  mock?: boolean;
};

export interface LyricsAssistant {
  readonly id: string;
  assist(req: AssistRequest): Promise<AssistResult>;
}
