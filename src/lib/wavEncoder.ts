/**
 * ترميز تسجيل المتصفح إلى WAV — يعمل في المتصفح فقط.
 * السبب: MediaRecorder ينتج webm/opus وهي صيغة لا تقبلها كل نماذج الصوت،
 * بينما WAV مدعومة في كل مكان. نفك الترميز عبر AudioContext ثم نعيد الترميز.
 */

export async function blobToWav(blob: Blob, targetRate = 16000): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    const mono = downmixToMono(decoded);
    const resampled = decoded.sampleRate === targetRate ? mono : resample(mono, decoded.sampleRate, targetRate);
    return new Blob([encodeWav(resampled, targetRate)], { type: "audio/wav" });
  } finally {
    await ctx.close().catch(() => {});
  }
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice();

  const out = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < buffer.length; i++) out[i] += data[i] / buffer.numberOfChannels;
  }
  return out;
}

/** إعادة أخذ عينات خطية — كافية تماماً لتحليل النطق */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  const ratio = fromRate / toRate;
  const length = Math.floor(input.length / ratio);
  const out = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const pos = i * ratio;
    const left = Math.floor(pos);
    const right = Math.min(left + 1, input.length - 1);
    const frac = pos - left;
    out[i] = input[left] * (1 - frac) + input[right] * frac;
  }
  return out;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(s * 32767), true);
  }
  return buffer;
}
