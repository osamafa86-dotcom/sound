import { VOICES } from "@/lib/voices";
import { pcm16ToWav } from "@/lib/mockAudio";
import { splitTextForTTS } from "@/lib/tts/split";
import type { AudioResult, TTSProvider, TTSRequest } from "./types";

/**
 * Azure Speech — أصوات Neural باللهجات العربية الأصيلة عبر SSML.
 * النصوص الطويلة تُقسَّم عند حدود الجمل وتُدمج المخرجات في ملف واحد.
 */

class AzureError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function buildSsml(text: string, voiceName: string, locale: string, speed: number): string {
  // سرعة 1 = 0%؛ النطاق المفيد ‎-50%‎..‎+50%‎
  const rate = Math.round((Math.min(1.5, Math.max(0.5, speed)) - 1) * 100);
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${locale}"><voice name="${voiceName}"><prosody rate="${rate >= 0 ? "+" : ""}${rate}%">${escapeXml(text)}</prosody></voice></speak>`;
}

export function azureTTS(apiKey: string, region: string): TTSProvider {
  return {
    id: "azure",
    async synthesize(req: TTSRequest): Promise<AudioResult> {
      const voice = VOICES.find((v) => v.id === req.voiceId);
      if (!voice?.azureVoiceName || !voice.azureLocale) {
        throw new AzureError(`لا يوجد صوت Azure مطابق للمعرّف ${req.voiceId}`, 400);
      }

      const wantWav = req.format === "wav";
      const outputFormat = wantWav
        ? "raw-44100hz-16bit-mono-pcm"
        : "audio-24khz-96kbitrate-mono-mp3";

      const chunks = splitTextForTTS(req.text);
      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
          method: "POST",
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": outputFormat,
            "User-Agent": "maqam-studio",
          },
          body: buildSsml(chunk, voice.azureVoiceName, voice.azureLocale, req.speed ?? 1),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          throw new AzureError(`Azure ${res.status}: ${detail.slice(0, 300)}`, res.status);
        }
        buffers.push(Buffer.from(await res.arrayBuffer()));
      }

      const joined = Buffer.concat(buffers);
      return {
        audio: wantWav ? pcm16ToWav(joined, 44100) : joined,
        mimeType: wantWav ? "audio/wav" : "audio/mpeg",
        provider: "azure",
      };
    },
  };
}
