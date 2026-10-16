import { VOICES } from "@/lib/voices";
import { applyPronunciationRules, findDictionary, listRules, type PronunciationRule } from "@/lib/pronunciation";
import { elevenTTSModel, isTagGeneration, voiceSettingsFor } from "@/lib/providers/elevenlabs";
import { firstMp3Frame, mp3Silence } from "@/lib/mp3Silence";
import { applyIpa } from "@/lib/arabic/ipa";
import { keepPresent } from "@/lib/tts/criticalWords";
import {
  cleanDeliveryTag,
  DRAMA_LIMITS,
  MAX_CRITICAL_PER_LINE,
  type DramaLine,
  type DramaScript,
} from "./types";

const API_BASE = "https://api.elevenlabs.io/v1";

/**
 * صيغة الإخراج: MP3 لأن PCM الخام محجوز لباقة Pro لدى ElevenLabs.
 * الأسطر تُدمج بترتيبها، والوقفة بعد كل سطر صمت MP3 حقيقي بإطارات السطر
 * نفسه — جيل الوسوم لا يقبل وسم <break>، والصمت المُلصق أدق منه أصلاً.
 */
const OUTPUT_FORMAT = process.env.ELEVENLABS_MP3_QUALITY ?? "mp3_44100_192";
const BYTES_PER_SEC = 192_000 / 8;
/** سقف الوقفة الواحدة — ما فوقه يقطع إيقاع المشهد */
const MAX_PAUSE_MS = 3000;
/**
 * أرضية الثبات لجيل الوسوم: الثبات المنخفض يجعل الجيل الرابع يعود لأشهر قراءة
 * للرسم (قيس على «مَعْرَكَةُ أُحُد»: 0.3 مع وسم ← خطأ 3 من 4). الضمان الحقيقي
 * الكتابة الصوتية للكلمات الحساسة (صحيحة 4 من 4 حتى عند 0.3)، والأرضية
 * حماية إضافية لما لم يُعلَّم منها.
 */
export const TAGGED_MIN_STABILITY = 0.5;

/**
 * نموذج الإنتاج الدرامي: نموذج النطق الكلاسيكي (الجيل الرابع افتراضياً)،
 * وELEVENLABS_DRAMA_MODEL يغيّره للدراما والبودكاست وحدهما بلا نشر.
 */
export function dramaModel(): string {
  return process.env.ELEVENLABS_DRAMA_MODEL?.trim() || elevenTTSModel(false);
}

type Dictionary = { id: string; versionId: string } | null;

export async function renderDrama(
  apiKey: string,
  script: DramaScript,
  onProgress?: (done: number, total: number) => void
): Promise<{ audio: Buffer; durationSec: number }> {
  const model = dramaModel();
  const tagged = isTagGeneration(model);

  // ذاكرة النطق: نصاً لجيل الوسوم (لا يدعم القواميس)، وقاموساً للجيل الثاني
  const rules: PronunciationRule[] = tagged ? await listRules(apiKey).catch(() => []) : [];
  const dict: Dictionary = tagged ? null : await findDictionary(apiKey).catch(() => null);

  const voiceOf = new Map(script.characters.map((c) => [c.id, c.voiceId]));

  const total = script.lines.length;
  let done = 0;
  const segments: Buffer[] = new Array(total);

  /**
   * التوازي بالصوت لا بالسطر: ElevenLabs يرفض طلبين متزامنين على الصوت نفسه
   * (409 already_running). فنجمع أسطر كل صوت في مسار يُنفَّذ بالتسلسل،
   * والمسارات المختلفة تعمل معاً — يبقى الزمن قصيراً بلا تعارض.
   */
  const byVoice = new Map<string, { line: DramaLine; index: number }[]>();
  script.lines.forEach((line, index) => {
    const catalogVoice = VOICES.find((v) => v.id === voiceOf.get(line.characterId));
    const elevenVoiceId = catalogVoice?.elevenVoiceId ?? VOICES[0].elevenVoiceId!;
    const bucket = byVoice.get(elevenVoiceId);
    if (bucket) bucket.push({ line, index });
    else byVoice.set(elevenVoiceId, [{ line, index }]);
  });

  const voiceTracks = [...byVoice.entries()];
  for (let i = 0; i < voiceTracks.length; i += DRAMA_LIMITS.concurrency) {
    await Promise.all(
      voiceTracks.slice(i, i + DRAMA_LIMITS.concurrency).map(async ([elevenVoiceId, items]) => {
        for (const { line, index } of items) {
          const { text, stability } = performLine(line, tagged, rules);
          const speech = await synthesizeLine(apiKey, elevenVoiceId, {
            text,
            model_id: model,
            voice_settings: voiceSettingsFor(model, { stability, speed: line.speed }),
            ...(dict?.id && {
              pronunciation_dictionary_locators: [
                { pronunciation_dictionary_id: dict.id, ...(dict.versionId && { version_id: dict.versionId }) },
              ],
            }),
          });
          segments[index] = withPause(speech, line.pauseAfterMs);
          done++;
          onProgress?.(done, total);
        }
      })
    );
  }

  const audio = Buffer.concat(segments.filter(Boolean));
  return { audio, durationSec: audio.length / BYTES_PER_SEC };
}

/**
 * نص السطر كما يُرسل للمحرك: ذاكرة النطق مطبّقة، ووسم الأداء في رأسه لجيل
 * الوسوم (الجيل الثاني يقرأ الوسوم كلمات فلا يصله). الوسم يُطهَّر هنا ثانيةً
 * لأن السيناريو يصل من المتصفح بعد تعديل المستخدم.
 */
export function performLine(
  line: Pick<DramaLine, "text" | "deliveryTag" | "stability" | "criticalWords">,
  tagged: boolean,
  rules: PronunciationRule[]
): { text: string; stability: number } {
  const remembered = rules.length ? applyPronunciationRules(line.text, rules) : line.text;
  if (!tagged) return { text: remembered, stability: line.stability };

  // النطق المضمون: كلمات الكاتب الحساسة وكلمات ذاكرة النطق بكتابتها الصوتية
  // (تُطهَّر ثانيةً لأن السيناريو يصل من المتصفح بعد تعديل المستخدم)
  const forced = [
    ...keepPresent(line.criticalWords, line.text, MAX_CRITICAL_PER_LINE),
    ...rules.map((r) => r.alias).filter((alias) => remembered.includes(alias)),
  ];
  const spoken = applyIpa(remembered, forced);

  const stability = Math.max(TAGGED_MIN_STABILITY, line.stability);
  const tag = cleanDeliveryTag(line.deliveryTag);
  if (!tag) return { text: spoken, stability };
  // الثبات «الرصين» يتجاهل الوسوم — كما في استوديو النطق يُسقف عند «طبيعي»
  return { text: `${tag} ${spoken}`, stability: stability >= 0.75 ? 0.5 : stability };
}

/** وقفة بعد السطر: صمت حقيقي بإطارات السطر نفسه (لا شيء إن لم يُفهم الإطار) */
export function withPause(speech: Buffer, pauseMs: number): Buffer {
  const ms = Math.min(MAX_PAUSE_MS, Math.max(0, pauseMs));
  const frame = ms > 0 ? firstMp3Frame(speech) : null;
  return frame ? Buffer.concat([speech, mp3Silence(ms, frame)]) : speech;
}

async function synthesizeLine(
  apiKey: string,
  elevenVoiceId: string,
  body: Record<string, unknown>,
  attempt = 0
): Promise<Buffer> {
  const res = await fetch(
    `${API_BASE}/text-to-speech/${elevenVoiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    // تعارض أو ازدحام لحظي: مهلة قصيرة ثم محاولة أخيرة قبل إفشال الإنتاج كله
    if ((res.status === 409 || res.status === 429) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      return synthesizeLine(apiKey, elevenVoiceId, body, attempt + 1);
    }
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
