import { VOICES } from "@/lib/voices";
import { pcm16ToWav } from "@/lib/mockAudio";
import { findDictionary } from "@/lib/pronunciation";
import { DRAMA_LIMITS, type DramaScript } from "./types";

const API_BASE = "https://api.elevenlabs.io/v1";
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
const SAMPLE_RATE = 44100;

/**
 * إنتاج العمل الدرامي: كل سطر يُولَّد بصوت شخصيته وإعداداته الشعورية،
 * ثم تُدمج الأسطر بصمت دقيق بينها.
 *
 * نطلب PCM خاماً لا MP3 لأن دمج الـ PCM دقيق تماماً ويسمح بإدراج صمت
 * بطول محسوب بالمللي ثانية — وهو ما يصنع إيقاع المشهد.
 */
export async function renderDrama(
  apiKey: string,
  script: DramaScript,
  onProgress?: (done: number, total: number) => void
): Promise<{ audio: Buffer; durationSec: number }> {
  const dict = await findDictionary(apiKey).catch(() => null);
  const voiceOf = new Map(script.characters.map((c) => [c.id, c.voiceId]));

  const total = script.lines.length;
  let done = 0;

  // توليد متوازٍ محدود: يقصّر الزمن دون إغراق المزوّد بالطلبات
  const segments: Buffer[] = new Array(total);
  const queue = script.lines.map((line, index) => ({ line, index }));

  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const { line, index } = item;

      const catalogVoice = VOICES.find((v) => v.id === voiceOf.get(line.characterId));
      const elevenVoiceId = catalogVoice?.elevenVoiceId ?? VOICES[0].elevenVoiceId!;

      const pcm = await synthesizeLine(apiKey, elevenVoiceId, line.text, line.stability, line.speed, dict);
      segments[index] = Buffer.concat([pcm, silence(line.pauseAfterMs)]);

      done++;
      onProgress?.(done, total);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(DRAMA_LIMITS.concurrency, total) }, () => worker())
  );

  const pcmAll = Buffer.concat(segments.filter(Boolean));
  return {
    audio: pcm16ToWav(pcmAll, SAMPLE_RATE),
    durationSec: pcmAll.length / (SAMPLE_RATE * 2),
  };
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
    `${API_BASE}/text-to-speech/${elevenVoiceId}?output_format=pcm_${SAMPLE_RATE}`,
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

/** صمت PCM بطول محدد — يصنع الوقفات بين الأسطر والمشاهد */
function silence(ms: number): Buffer {
  const samples = Math.max(0, Math.round((ms / 1000) * SAMPLE_RATE));
  return Buffer.alloc(samples * 2); // 16-bit = صفران لكل عيّنة
}
