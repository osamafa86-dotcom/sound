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
