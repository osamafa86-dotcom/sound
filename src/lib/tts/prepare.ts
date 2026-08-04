import { getVoiceTuning } from "@/lib/brain";
import { getCustomVoice } from "@/lib/customVoices";
import { applyPronunciationRules, listRules } from "@/lib/pronunciation";
import { classifyStyle, getStyle, layerTagPrefix, styleTagPrefix } from "@/lib/performance/styles";
import { hasAudioTags, stripAudioTags, stripBidiMarks } from "@/lib/performance/tags";
import type { TTSRequest } from "@/lib/providers/types";

/** فشل تحضيري — يُعاد للعميل بنصه ورمز حالته كما هو */
export type TTSPrepareError = { error: string; status: number };

/**
 * تحضير طلب TTS من جسد الطلب الخام — خط الأنابيب المشترك بين مسار
 * التوليد المخزّن (/api/tts) ومسار البث المتدفق (/api/tts/stream):
 * تنظيف النص، حل الأصوات المستنسخة، تصنيف الأسلوب، طبقات الأداء،
 * موجه المخرج، ذاكرة النطق، والإعدادات المتعلمة من تقييمات المستخدمين.
 */
export async function prepareTTSRequest(
  body: unknown,
  userId: string | null
): Promise<{ request: TTSRequest } | TTSPrepareError> {
  const raw = (body ?? {}) as Record<string, unknown>;

  // علامات الاتجاه غير المرئية (تُدرج للعرض السليم في المحرر) لا تصل للمحرك
  let text = typeof raw.text === "string" ? stripBidiMarks(raw.text.trim()) : "";

  if (!text) {
    return { error: "النص مطلوب", status: 400 };
  }
  // النصوص الطويلة تُقسَّم عند حدود الجمل وتُدمج تلقائياً — يدعم الكتب الصوتية
  if (text.length > 20000) {
    return { error: "الحد الأقصى 20000 حرف", status: 400 };
  }

  const voiceId = typeof raw.voiceId === "string" ? raw.voiceId : "";

  // الأصوات المستنسخة (clone-xxx): تُحل من سجل المستخدم وتمرر معرّفها مباشرة
  let elevenVoiceId: string | undefined;
  if (voiceId.startsWith("clone-")) {
    const custom = await getCustomVoice(voiceId.replace(/^clone-/, ""), userId);
    if (!custom) {
      return { error: "الصوت المستنسخ غير موجود أو ليس ملكك", status: 404 };
    }
    elevenVoiceId = custom.id;
  }

  // أسلوب الأداء: صريح، أو «تلقائي» يحلله Gemini من النص نفسه
  const geminiKey = process.env.GEMINI_API_KEY;
  let styleId = typeof raw.styleId === "string" ? raw.styleId : "";
  if (styleId === "auto" && geminiKey) {
    styleId = (await classifyStyle(geminiKey, text)) ?? "";
  }
  const style = getStyle(styleId);

  // قاعدة الطبقات: حالة جسدية وبيئة صوتية تتراكب فوق الأسلوب الأساسي
  const layerIds = Array.isArray(raw.layerIds)
    ? raw.layerIds.filter((l): l is string => typeof l === "string").slice(0, 4)
    : [];
  const layersPrefix = layerTagPrefix(layerIds);

  // موجه المخرج الحر — توجيه إضافي يُحقن كوسم (بلا أقواس متداخلة أو أسطر)
  const directorNote =
    typeof raw.directorNote === "string"
      ? raw.directorNote.replace(/[[\]\n\r]/g, " ").trim().slice(0, 200)
      : "";

  // المحرك التعبيري يُفعَّل بأسلوب أو طبقات أو موجه أو وسوم داخل النص أو طلب صريح
  const textHasTags = hasAudioTags(text);
  const expressive =
    raw.expressive === true ||
    !!style ||
    !!layersPrefix ||
    !!directorNote ||
    (raw.expressive !== false && textHasTags);

  // المحرك الكلاسيكي يقرأ الوسوم ككلمات («ساد»!) — تُنزع قبل وصوله
  if (!expressive && textHasTags) {
    text = stripAudioTags(text);
  }

  // الجيل الثالث لا يدعم قواميس النطق — ذاكرة النطق تُطبَّق نصياً قبل التوليد
  const elevenKey = process.env.ELEVENLABS_API_KEY;
  if (expressive && elevenKey) {
    const rules = await listRules(elevenKey).catch(() => []);
    if (rules.length) text = applyPronunciationRules(text, rules);
  }

  const request: TTSRequest = {
    text,
    voiceId,
    elevenVoiceId,
    // ثبات الأسلوب المضبوط مخبرياً يتقدم حين لا يحدد المستخدم شيئاً
    stability: typeof raw.stability === "number" ? raw.stability : style?.stability,
    speed: typeof raw.speed === "number" ? raw.speed : undefined,
    format: raw.format === "wav" ? "wav" : "mp3",
    expressive,
    // بادئة مركّبة: أسلوب + طبقات + موجه المخرج — بترتيب العموم فالخصوص
    stylePrefix:
      [style ? styleTagPrefix(style) : "", layersPrefix, directorNote ? `[${directorNote}]` : ""]
        .filter(Boolean)
        .join(" ") || undefined,
    liveliness: typeof raw.liveliness === "number" ? raw.liveliness : undefined,
    speakerBoost: raw.speakerBoost !== false,
  };

  // الثبات «الرصين» يتجاهل الوسوم رسمياً — وجودها في النص يسقف الثبات عند «طبيعي»
  if (expressive && textHasTags && (request.stability ?? 0.5) >= 0.75) {
    request.stability = 0.5;
  }

  // عقل المنصة: عند غياب الإعدادات تُطبَّق القيم المتعلمة من التوليدات عالية التقييم
  if (request.stability === undefined || request.speed === undefined) {
    const learned = (await getVoiceTuning()).get(voiceId);
    if (learned) {
      request.stability ??= learned.stability;
      request.speed ??= learned.speed;
    }
  }

  return { request };
}
