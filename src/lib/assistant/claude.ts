import Anthropic from "@anthropic-ai/sdk";
import { DIALECTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import type { AssistRequest, AssistResult, LyricsAssistant } from "./types";

/** النموذج الافتراضي Claude Opus 5 — قابل للتبديل عبر متغير البيئة دون تغيير الكود */
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * مخطط JSON الذي يُلزم النموذج بإرجاع النتيجة كاملة البنية (Structured Outputs) —
 * لا حاجة لأي تحليل نصي يدوي للاستجابة.
 */
const RESULT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "عنوان قصير وجذاب للأغنية بالعربية" },
    lyrics: {
      type: "string",
      description: "كلمات الأغنية كاملة بالعربية، مقسّمة أسطراً ومقاطع (مطلع، لازمة، مقاطع) بعناوين واضحة",
    },
    maqamId: { type: "string", enum: MAQAMAT.map((m) => m.id) },
    maqamReason: { type: "string", description: "تعليل اختيار المقام بالعربية في جملة أو جملتين موجهتين للمستخدم" },
    stylePromptEn: {
      type: "string",
      description:
        "Professional English music-generation prompt for AI music engines: maqam name, quarter tones if applicable, suggested instruments, rhythm pattern, tempo, mood, and song structure. One dense paragraph under 400 characters.",
    },
  },
  required: ["title", "lyrics", "maqamId", "maqamReason", "stylePromptEn"],
  additionalProperties: false,
};

function buildSystemPrompt(): string {
  const maqamList = MAQAMAT.map(
    (m) => `- ${m.id}: مقام ${m.name} — الطابع: ${m.mood}. ${m.description}`
  ).join("\n");

  return `أنت شاعر غنائي محترف وخبير في علم المقامات الموسيقية العربية، تعمل داخل منصة «مقام» لتوليد الأغاني بالذكاء الاصطناعي.

مهمتك في كل طلب:
1. كتابة كلمات أغنية عربية أصيلة (أو تحسين كلمات المستخدم مع الحفاظ على معناها وشخصيتها وصوته الخاص) باللهجة والأسلوب المطلوبين، ببنية غنائية واضحة: مطلع، لازمة تتكرر، ومقاطع.
2. اختيار المقام الأنسب لمعنى الكلمات ومزاجها من القائمة التالية حصراً (استخدم قيمة id كما هي):
${maqamList}
3. صياغة برومبت موسيقي احترافي بالإنجليزية لمحرك توليد الموسيقى، يصف المقام وأرباع النغمات إن وُجدت والآلات الشرقية المناسبة والإيقاع والسرعة والمزاج وبنية الأغنية — فمحركات التوليد لا تفهم «المقام» كمعامل تقني بل عبر وصف الأسلوب الدقيق.

قواعد الكتابة: التزم باللهجة المطلوبة بدقة، وراعِ الوزن والقافية وقابلية الغناء، وتجنّب الحشو والتكرار غير المقصود.`;
}

function buildUserPrompt(req: AssistRequest): string {
  const dialect = DIALECTS.find((d) => d.id === req.dialectId) ?? DIALECTS[0];
  const style = SONG_STYLES.find((s) => s.id === req.styleId) ?? SONG_STYLES[0];
  const base = [`اللهجة المطلوبة: ${dialect.name}`, `الأسلوب الغنائي: ${style.name}`];

  if (req.mode === "write") {
    base.push(`اكتب كلمات أغنية كاملة من هذه الفكرة:\n${req.idea}`);
  } else {
    base.push(`حسّن كلمات الأغنية التالية مع الحفاظ على معناها وشخصيتها، واقترح المقام الأنسب لها:\n${req.lyrics}`);
  }
  return base.join("\n\n");
}

export function claudeAssistant(apiKey: string): LyricsAssistant {
  return {
    id: "claude",
    async assist(req: AssistRequest): Promise<AssistResult> {
      const client = new Anthropic({ apiKey });

      // الرجوع الخادمي التلقائي عند رفض مصنّفات الأمان — مدعوم على نماذج Opus 5 / Fable 5 فقط
      const useServerFallbacks = MODEL === "claude-opus-5" || MODEL === "claude-fable-5";

      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: buildSystemPrompt(),
        messages: [{ role: "user", content: buildUserPrompt(req) }],
        output_config: { format: { type: "json_schema", schema: RESULT_SCHEMA } },
        ...(useServerFallbacks && {
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default" as const,
        }),
      });

      if (response.stop_reason === "refusal") {
        throw new Error("رفض نموذج الذكاء الاصطناعي معالجة هذا الطلب — جرّب صياغة مختلفة");
      }
      if (response.stop_reason === "max_tokens") {
        throw new Error("تجاوزت الاستجابة الحد المسموح — جرّب فكرة أو كلمات أقصر");
      }

      const text = response.content.find((b) => b.type === "text")?.text;
      if (!text) {
        throw new Error("استجابة فارغة من النموذج");
      }

      const data = JSON.parse(text) as Omit<AssistResult, "provider" | "mock">;
      // حماية إضافية فوق المخطط: تأكيد أن المقام المُرجَع موجود فعلاً في قائمتنا
      const maqamId = MAQAMAT.some((m) => m.id === data.maqamId) ? data.maqamId : MAQAMAT[0].id;

      return {
        title: data.title,
        lyrics: data.lyrics,
        maqamId,
        maqamReason: data.maqamReason,
        stylePromptEn: data.stylePromptEn,
        provider: "claude",
      };
    },
  };
}
