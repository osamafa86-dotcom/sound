/**
 * لمسة الماستر — معالجة نهائية في المتصفح (بلا خوادم ولا تكلفة):
 * 1. قص الصمت الزائد من الأطراف
 * 2. ضبط علو الصوت (تطبيع الذروة إلى -1dBFS)
 * 3. دخول وخروج ناعمان (fade in/out)
 * الناتج WAV ستيريو بجودة الملف الأصلية.
 */

const SILENCE_THRESHOLD = 0.004; // ≈ -48dBFS
const EDGE_PAD_SEC = 0.12;
const FADE_IN_SEC = 0.35;
const FADE_OUT_SEC = 0.9;
const TARGET_PEAK = 0.891; // -1dBFS
const MAX_BOOST = 4;

export async function masterAudio(blob: Blob): Promise<Blob> {
  const raw = await blob.arrayBuffer();
  const probe = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await probe.decodeAudioData(raw);
  } finally {
    await probe.close().catch(() => {});
  }

  const channels = Math.min(2, decoded.numberOfChannels);
  const rate = decoded.sampleRate;

  // حدود المحتوى المسموع (أقصى قيمة مطلقة عبر القنوات)
  let start = 0;
  let end = decoded.length - 1;
  const datas = Array.from({ length: channels }, (_, c) => decoded.getChannelData(c));
  const loudAt = (i: number) => datas.some((d) => Math.abs(d[i]) > SILENCE_THRESHOLD);
  while (start < end && !loudAt(start)) start++;
  while (end > start && !loudAt(end)) end--;

  const pad = Math.round(EDGE_PAD_SEC * rate);
  start = Math.max(0, start - pad);
  end = Math.min(decoded.length - 1, end + pad);
  const length = end - start + 1;
  if (length < rate) return blob; // أقصر من ثانية بعد القص — الملف ليس موسيقى فعلية

  // ذروة المقطع المقصوص لتحديد كسب التطبيع
  let peak = 0;
  for (const d of datas) {
    for (let i = start; i <= end; i++) {
      const v = Math.abs(d[i]);
      if (v > peak) peak = v;
    }
  }
  const gain = peak > 0 ? Math.min(MAX_BOOST, TARGET_PEAK / peak) : 1;

  const trimmed = new AudioBuffer({ numberOfChannels: channels, length, sampleRate: rate });
  for (let c = 0; c < channels; c++) {
    trimmed.copyToChannel(datas[c].subarray(start, end + 1), c);
  }

  const offline = new OfflineAudioContext(channels, length, rate);
  const source = offline.createBufferSource();
  source.buffer = trimmed;
  const g = offline.createGain();
  const durationSec = length / rate;
  const fadeIn = Math.min(FADE_IN_SEC, durationSec / 4);
  const fadeOut = Math.min(FADE_OUT_SEC, durationSec / 4);
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(gain, fadeIn);
  g.gain.setValueAtTime(gain, durationSec - fadeOut);
  g.gain.linearRampToValueAtTime(0, durationSec);
  source.connect(g).connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return new Blob([encodeWavStereo(rendered)], { type: "audio/wav" });
}

/** ترميز WAV بعدد قنوات الملف (١ أو ٢) بعمق 16-bit */
function encodeWavStereo(buffer: AudioBuffer): ArrayBuffer {
  const channels = buffer.numberOfChannels;
  const rate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerFrame = channels * 2;
  const out = new ArrayBuffer(44 + frames * bytesPerFrame);
  const view = new DataView(out);

  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + frames * bytesPerFrame, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, frames * bytesPerFrame, true);

  let offset = 44;
  const chans = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(offset, Math.round(s * 32767), true);
      offset += 2;
    }
  }
  return out;
}
