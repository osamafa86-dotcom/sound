/**
 * الاستوديو الدرامي — تحويل نص إلى عمل مسموع متعدد الأصوات.
 *
 * السيناريو هو الوسيط بين التحليل والإنتاج: يحدد الشخصيات وأصواتها،
 * وكل سطر بمن يقوله وبأي انفعال، فيمكن للمستخدم مراجعته وتعديله قبل التوليد.
 */

export type DramaCharacter = {
  /** معرّف داخلي يربط الأسطر بالشخصية، مثل: narrator أو char1 */
  id: string;
  name: string;
  /** وصف موجز للشخصية بالعربية (العمر، الطبع، دورها) */
  description: string;
  /** معرّف الصوت من كتالوج المنصة */
  voiceId: string;
  /** سبب اختيار هذا الصوت لهذه الشخصية */
  voiceReason: string;
};

export type DramaLine = {
  /** معرّف الشخصية المتحدثة */
  characterId: string;
  /** النص مشكّلاً تشكيلاً كاملاً وجاهزاً للنطق */
  text: string;
  /** الحالة الشعورية بالعربية: هادئ، غاضب، متحسّر، متشوّق... */
  emotion: string;
  /** وسم أداء إنجليزي من DELIVERY_TAGS يجسّد الانفعال صوتياً — غيابه سرد محايد */
  deliveryTag?: string;
  /** كلمات السطر الحساسة للنطق (أعلام، كلمات تتغير بحركاتها) — تُفرض صوتياً */
  criticalWords?: string[];
  /** 0..1 — ينخفض في لحظات الانفعال ويرتفع في السرد المتزن */
  stability: number;
  /** 0.7..1.2 */
  speed: number;
  /** صمت بعد السطر بالمللي ثانية — إيقاع المشهد */
  pauseAfterMs: number;
};

export type DramaScript = {
  title: string;
  /** ملخص العمل في سطر أو سطرين */
  summary: string;
  characters: DramaCharacter[];
  lines: DramaLine[];
  /** مزاج العمل العام بالعربية */
  mood: string;
  /** المقام المقترح للموسيقى الخلفية */
  maqamId: string;
  /** برومبت إنجليزي جاهز لمحرك الموسيقى */
  musicPromptEn: string;
};

/** حدود الإنتاج — تحمي التكلفة وزمن الاستجابة */
export const DRAMA_LIMITS = {
  maxInputChars: 6000,
  maxLines: 40,
  maxLineChars: 600,
  /** عدد طلبات التوليد المتوازية إلى محرك النطق */
  concurrency: 4,
} as const;

/**
 * وسوم الأداء المسموحة لأسطر السيناريو — من قائمة الجيل الرابع الموثقة
 * لدى ElevenLabs (انفعال، طريقة إلقاء، خامة صوت، أصوات غير لفظية).
 * قائمة مغلقة كي لا يخترع المحلل وسماً يُقرأ كلمات أو يتجاهله المحرك.
 */
export const DELIVERY_TAGS = [
  "[happy]",
  "[sad]",
  "[angry]",
  "[excited]",
  "[nervous]",
  "[curious]",
  "[sarcastic]",
  "[surprised]",
  "[tired]",
  "[warmly]",
  "[whispers]",
  "[shouting]",
  "[softly]",
  "[dramatically]",
  "[cautiously]",
  "[slowly]",
  "[trembling voice]",
  "[breathless]",
  "[laughs]",
  "[chuckles]",
  "[sighs]",
  "[gasps]",
  "[crying]",
  "[clears throat]",
] as const;

/** قيمة «بلا وسم» في مخطط المحلل — السرد المتزن لا يحتاج توجيهاً */
export const NO_DELIVERY_TAG = "none";

/** وسم صالح من القائمة أو لا شيء — تطهير ناتج المحلل وما يعدّله المستخدم */
export function cleanDeliveryTag(tag: unknown): string | undefined {
  return typeof tag === "string" && (DELIVERY_TAGS as readonly string[]).includes(tag) ? tag : undefined;
}

/** سقف الكلمات الحساسة للسطر الواحد — ما زاد يجعل السطر كتابةً صوتية لا عربية */
export const MAX_CRITICAL_PER_LINE = 6;
