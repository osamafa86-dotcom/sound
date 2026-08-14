import Anthropic from "@anthropic-ai/sdk";
import { DIALECTS, MAQAMAT, SONG_STYLES } from "@/lib/maqamat";
import { heritageAssistBlock } from "@/lib/heritage/palestinian";
import { parseSections, sanitizeSections } from "@/lib/songSections";
import { PLAN_PROMPT_LINE, planSchemaProps, sanitizePlan, verbatimSections } from "./plan";
import type { AssistRequest, AssistResult, LyricsAssistant } from "./types";

/** النموذج الافتراضي Claude Opus 5 — قابل للتبديل عبر متغير البيئة دون تغيير الكود */
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

/**
 * مخطط JSON الذي يُلزم النموذج بإرجاع النتيجة كاملة البنية (Structured Outputs) —
 * لا حاجة لأي تحليل نصي يدوي للاستجابة. في الوضع الذكي يُضاف حقل الخطة.
 */
function resultSchema(wantPlan: boolean) {
  return {
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
      sections: {
        type: "array",
        description: "الكلمات نفسها مقسّمة مقاطع مُهيكلة بالترتيب الزمني للأغنية",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["intro", "verse", "chorus", "bridge", "outro"] },
            lyrics: { type: "string", description: "أسطر هذا المقطع فقط — فارغة للمقدمة/الخاتمة الآلية" },
            durationSec: { type: "number", description: "مدة واقعية بالثواني (سطر مغنّى ≈ 7 ثوانٍ)" },
          },
          required: ["kind", "lyrics", "durationSec"],
          additionalProperties: false,
        },
      },
      ...(wantPlan && {
        plan: {
          type: "object",
          description: "خطة التلحين الكاملة التي قررتها بنفسك",
          properties: planSchemaProps(),
          required: ["styleId", "singer", "dialectId", "instrumentIds", "bpm", "reason"],
          additionalProperties: false,
        },
      }),
    },
    required: [
      "title",
      "lyrics",
      "maqamId",
      "maqamReason",
      "stylePromptEn",
      "sections",
      ...(wantPlan ? ["plan"] : []),
    ],
    additionalProperties: false,
  };
}

/** حقن أمثلة عقل المنصة: برومبتات سبق أن أنتجت أغاني نالت أعلى رضا المستخدمين */
function exemplarsBlock(exemplars?: AssistRequest["exemplars"]): string {
  if (!exemplars?.length) return "";
  const lines = exemplars.map((e) => {
    const maqam = MAQAMAT.find((m) => m.id === e.maqamId);
    return `- ${maqam ? `(مقام ${maqam.name}) ` : ""}${e.stylePrompt}`;
  });
  return `

برومبتات موسيقية سابقة نالت أعلى تقييم من مستخدمي المنصة — احتذِ ببنيتها ومستوى تفصيلها دون نسخها حرفياً:
${lines.join("\n")}`;
}

function buildSystemPrompt(exemplars?: AssistRequest["exemplars"], wantPlan?: boolean): string {
  const maqamList = MAQAMAT.map(
    (m) => `- ${m.id}: مقام ${m.name} — الطابع: ${m.mood}. ${m.description}`
  ).join("\n");

  return `أنت شاعر غنائي محترف وخبير في علم المقامات الموسيقية العربية والتركية والسلالم الغربية، تعمل داخل منصة «لحّن» لتوليد الأغاني بالذكاء الاصطناعي.

مهمتك في كل طلب:
1. كتابة كلمات أغنية عربية أصيلة (أو تحسين كلمات المستخدم مع الحفاظ على معناها وشخصيتها وصوته الخاص) باللهجة والأسلوب المطلوبين، ببنية غنائية واضحة: مطلع، لازمة تتكرر، ومقاطع.
2. اختيار المقام الأنسب لمعنى الكلمات ومزاجها من القائمة التالية حصراً (استخدم قيمة id كما هي):
${maqamList}
3. صياغة برومبت موسيقي احترافي بالإنجليزية لمحرك توليد الموسيقى، يصف المقام وأرباع النغمات إن وُجدت والآلات المناسبة والإيقاع والسرعة والمزاج وبنية الأغنية — فمحركات التوليد لا تفهم «المقام» كمعامل تقني بل عبر وصف الأسلوب الدقيق.
4. تقسيم الكلمات نفسها إلى مقاطع مُهيكلة (sections) بالترتيب: مقدمة آلية قصيرة (intro بلا كلمات)، ثم مقاطع (verse) ولازمة (chorus) تتكرر بعد كل مقطع، وجسر (bridge) عند الحاجة، وخاتمة (outro). قدّر مدة كل مقطع بواقعية: السطر المغنّى ≈ 7 ثوانٍ، والمقدمة والخاتمة 8–15 ثانية.${wantPlan ? `\n${PLAN_PROMPT_LINE}` : ""}

قواعد الكتابة: التزم باللهجة المطلوبة بدقة، وراعِ الوزن والقافية وقابلية الغناء، وتجنّب الحشو والتكرار غير المقصود.${exemplarsBlock(exemplars)}`;
}

function buildUserPrompt(req: AssistRequest): string {
  const dialect = DIALECTS.find((d) => d.id === req.dialectId) ?? DIALECTS[0];
  const style = SONG_STYLES.find((s) => s.id === req.styleId) ?? SONG_STYLES[0];
  // الوضع الذكي: لا قيود مسبقة — المساعد نفسه يقرر اللهجة واللون ضمن الخطة
  const base = req.auto
    ? ["أنت من يقرر اللهجة واللون الغنائي وكل تفاصيل الخطة — اختر ما يخدم النص."]
    : [`اللهجة المطلوبة: ${dialect.name}`, `الأسلوب الغنائي: ${style.name}`];

  if (req.mode === "write") {
    base.push(`اكتب كلمات أغنية كاملة من هذه الفكرة:\n${req.idea}`);
  } else if (req.mode === "plan") {
    base.push(
      `هذه كلمات المستخدم الجاهزة — لا تعدّل فيها حرفاً واحداً؛ أعدها كما هي في حقل lyrics، وقسّمها في sections ببنية غنائية (مقدمة وخاتمة آليتان بلا كلمات، والمقاطع واللازمة من أسطرها نفسها دون تغيير أي كلمة — إضافة التشكيل وحدها مسموحة لأنها عون نطق)، وضع لها عنواناً، واقترح المقام، وقرر الخطة:\n${req.lyrics}`
    );
  } else {
    base.push(`حسّن كلمات الأغنية التالية مع الحفاظ على معناها وشخصيتها، واقترح المقام الأنسب لها:\n${req.lyrics}`);
  }
  // ذاكرة التراث: قالب الكتابة الصريح أو بنية الأسلوب + المعجم الفلسطيني
  // (في الوضع الذكي لا أسلوب مسبقاً — فلا حقن تراثياً مشروطاً به)
  return base.join("\n\n") + (req.auto ? "" : heritageAssistBlock(req.dialectId, req.styleId, req.formId));
}

export function claudeAssistant(apiKey: string): LyricsAssistant {
  return {
    id: "claude",
    async assist(req: AssistRequest): Promise<AssistResult> {
      const client = new Anthropic({ apiKey });
      const wantPlan = req.auto === true || req.mode === "plan";

      // الرجوع الخادمي التلقائي عند رفض مصنّفات الأمان — مدعوم على نماذج Opus 5 / Fable 5 فقط
      const useServerFallbacks = MODEL === "claude-opus-5" || MODEL === "claude-fable-5";

      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: buildSystemPrompt(req.exemplars, wantPlan),
        messages: [{ role: "user", content: buildUserPrompt(req) }],
        output_config: { format: { type: "json_schema", schema: resultSchema(wantPlan) } },
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

      const data = JSON.parse(text) as Omit<AssistResult, "provider" | "mock"> & { plan?: unknown };
      // حماية إضافية فوق المخطط: تأكيد أن المقام المُرجَع موجود فعلاً في قائمتنا
      const maqamId = MAQAMAT.some((m) => m.id === data.maqamId) ? data.maqamId : MAQAMAT[0].id;

      // وضع الخطة: كلمات المستخدم مقدسة — تُعاد حرفياً وتُقسم مقاطع منها هي لا من النموذج
      const verbatim = req.mode === "plan" ? (req.lyrics ?? "").trim() : "";
      const lyrics = verbatim || data.lyrics;

      return {
        title: data.title,
        lyrics,
        maqamId,
        maqamReason: data.maqamReason,
        stylePromptEn: data.stylePromptEn,
        // مقاطع النموذج بعد التحقيق، أو تقسيم استدلالي من النص عند غيابها
        // (وفي وضع الخطة: بنية النموذج تُقبل فقط إن حملت كلمات المستخدم حرفياً)
        sections: verbatim
          ? verbatimSections(verbatim, data.sections)
          : (sanitizeSections(data.sections) ?? parseSections(data.lyrics)),
        ...(wantPlan && { plan: sanitizePlan(data.plan) }),
        provider: "claude",
      };
    },
  };
}
