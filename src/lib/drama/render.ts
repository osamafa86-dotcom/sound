import { VOICES } from "@/lib/voices";
import { findDictionary } from "@/lib/pronunciation";
import { DRAMA_LIMITS, type DramaScript } from "./types";

const API_BASE = "https://api.elevenlabs.io/v1";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";

/**
 * صيغة الإخراج: MP3 لأن PCM الخام محجوز لباقة Pro لدى ElevenLabs.
 * الأسطر تُدمج بترتيبها، والوقفات تُطلب داخل النص عبر وسم break
 * فتُنتَج ضمن الصوت نفسه — أدق من محاولة حقن صمت في تيار MP3 مضغوط.
 */
const OUTPUT_FORMAT = process.env.ELEVENLABS_MP3_QUALITY ?? "mp3_44100_192";
const BYTES_PER_SEC = 192_000 / 8;

export async function renderDrama(
  apiKey: string,
  script: DramaScript,
  onProgress?: (done: number, total: number) => void
): Promise<{ audio: Buffer; durationSec: number }> {
  const dict = await findDictionary(apiKey).catch(() => null);
  const voiceOf = new Map(script.characters.map((c) => [c.id, c.voiceId]));

  const total = script.lines.length;
  let done = 0;

  const segments: Buffer[] = new Array(total);
  const queue = script.lines.map((line, index) => ({ line, index }));

  // توليد متوازٍ محدود: يقصّر الزمن دون إغراق المزوّد بالطلبات
  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const { line, index } = item;

      const catalogVoice = VOICES.find((v) => v.id === voiceOf.get(line.characterId));
      const elevenVoiceId = catalogVoice?.elevenVoiceId ?? VOICES[0].elevenVoiceId!;

      segments[index] = await synthesizeLine(
        apiKey,
        elevenVoiceId,
        withPause(line.text, line.pauseAfterMs),
        line.stability,
        line.speed,
        dict
      );

      done++;
      onProgress?.(done, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DRAMA_LIMITS.concurrency, total) }, () => worker())
  );

  const audio = Buffer.concat(segments.filter(Boolean));
  return { audio, durationSec: audio.length / BYTES_PER_SEC };
}

/** وقفة بعد السطر تُطلب من المحرك نفسه — يدعمها نموذج multilingual */
function withPause(text: string, pauseMs: number): string {
  const seconds = Math.min(3, Math.max(0, pauseMs / 1000));
  if (seconds < 0.15) return text;
  return `${text} <break time="${seconds.toFixed(1)}s" />`;
}

async function synthesizeLine(
  apiKey: string,
  elevenVoiceId: string,
  text: string,
  stability: number,
  speed: number,
  dict: { id: string; versionId: string } | null
): Promise<Buffer> {
  const res = await fetch(
    `${API_BASE}/text-to-speech/${elevenVoiceId}?output_format=${OUTPUT_FORMAT}`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability,
          similarity_boost: 0.75,
          speed: Math.min(1.2, Math.max(0.7, speed)),
        },
        ...(dict?.id && {
          pronunciation_dictionary_locators: [
            { pronunciation_dictionary_id: dict.id, ...(dict.versionId && { version_id: dict.versionId }) },
          ],
        }),
      }),
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
