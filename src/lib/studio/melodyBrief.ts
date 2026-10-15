import { MAQAMAT } from "@/lib/maqamat";

/**
 * من لحن مرجعي إلى موجز أسلوبي — أذن المنصة.
 *
 * نموذج متعدد الوسائط يستمع للحن المرفوع (عزف، دندنة، أغنية قديمة...)
 * ويترجم روحه لا نوتاته: الطابع المقامي والإيقاع والسرعة والآلات،
 * ثم يكتب برومبتاً إنجليزياً يقود محرك التوليد لتأليف جديد أصيل
 * بالروح نفسها — استلهاماً لا نسخاً، كي لا يستفز مرشّح إعادة الإنتاج.
 */

const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";

export type MelodyBrief = {
  /** وصف عربي لما سُمع وكيف تُرجم موسيقياً */
  descriptionAr: string;
  maqamId: string;
  stylePromptEn: string;
  bpm?: number;
};

const SCHEMA = {
  type: "object",
  properties: {
    descriptionAr: {
      type: "string",
      description:
        "وصف عربي في جملتين: ما الذي سمعته في اللحن المرجعي (طابعه وإيقاعه وآلاته) وما الروح التي ستُستلهم منه",
    },
    maqamId: { type: "string", enum: MAQAMAT.map((m) => m.id) },
    stylePromptEn: {
      type: "string",
      description:
        "Professional English music-generation prompt capturing the SPIRIT of the reference (maqam character, rhythm feel, tempo, instrumentation, dynamics) for a brand-new ORIGINAL composition inspired by it — never a copy or transcription. One dense paragraph under 400 characters.",
    },
    bpm: { type: "integer", description: "السرعة التقريبية المسموعة (40-200)" },
  },
  required: ["descriptionAr", "maqamId", "stylePromptEn"],
  propertyOrdering: ["descriptionAr", "maqamId", "stylePromptEn", "bpm"],
};

function buildPrompt(): string {
  const maqamList = MAQAMAT.map((m) => `- ${m.id}: مقام ${m.name} — ${m.mood}`).join("\n");
  return `أنت مؤلف موسيقي عربي محترف وخبير مقامات داخل منصة «مقام».

استمع للمقطع الصوتي المرفق بأذن الموسيقي: هذا لحن مرجعي رفعه المستخدم ليُستلهم منه تأليف جديد.
حلّل طابعه المقامي وإيقاعه وسرعته وآلاته ومزاجه، ثم أعد:
1. وصفاً عربياً موجزاً لما سمعت.
2. المقام الأقرب لطابعه من هذه القائمة حصراً (استخدم قيمة id كما هي):
${maqamList}
3. برومبتاً إنجليزياً لمحرك التوليد يعيد إنتاج روح اللحن في تأليف جديد أصيل تماماً — استلهام الطابع والإيقاع والتوزيع، لا نسخ اللحن ولا اقتباسه.
4. السرعة التقريبية BPM.`;
}

export async function melodyToStyleBrief(
  apiKey: string,
  audio: { data: Buffer; mimeType: string }
): Promise<MelodyBrief> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: buildPrompt() },
              {
                inlineData: {
                  mimeType: audio.mimeType,
                  data: audio.data.toString("base64"),
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }

  const json = await res.json();
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("لم يُعد المحلل موجزاً");

  const brief = JSON.parse(raw) as MelodyBrief;
  if (!brief.stylePromptEn?.trim()) throw new Error("موجز بلا برومبت أسلوبي");
  // مقام خارج القائمة (هلوسة نادرة) — نتجاهله ونبقي الموجز
  if (!MAQAMAT.some((m) => m.id === brief.maqamId)) brief.maqamId = "";
  if (brief.bpm !== undefined && (!Number.isFinite(brief.bpm) || brief.bpm < 40 || brief.bpm > 200)) {
    delete brief.bpm;
  }
  return brief;
}
