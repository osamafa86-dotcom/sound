import {
  PEAK_CEILING,
  TARGET_LUFS,
  dbToLinear,
  gainToTarget,
  integratedLufs,
  limitPeaks,
} from "./loudness";

/**
 * لمسة الماستر — معالجة نهائية في المتصفح (بلا خوادم ولا تكلفة):
 * 1. قص الصمت الزائد من الأطراف (مع إرجاع مقدار القص ليُزاح توقيت الكاريوكي)
 * 2. جهارة بمعيار البث: قياس LUFS متكامل (ITU-R BS.1770) وضبط نحو -14 LUFS
 *    — كما تطبّع Spotify وYouTube — بدل تطبيع الذروة الأعمى
 * 3. محدد ذروة بنظرة أمامية يمسك القمم عند ~-1dB بلا قصّ صلب
 * 4. دخول وخروج ناعمان قصيران لا يوهنان أول كلمة ولا يقصّان الذيل
 * الناتج WAV ستيريو بمعدل عينات الملف الأصلي.
 */

const SILENCE_THRESHOLD = 0.004; // ≈ -48dBFS
const EDGE_PAD_SEC = 0.12;
const FADE_IN_SEC = 0.12;
const FADE_OUT_SEC = 0.5;

export type MasterResult = {
  blob: Blob;
  /** الثواني المقصوصة من مقدمة الملف — تُطرح من توقيتات الكاريوكي المحفوظة */
  trimmedLeadSec: number;
  /** false عندما يعود الملف الأصلي كما هو (أقصر من ثانية) — لا يُعلَّم mastered */
  changed: boolean;
  /** الجهارة المقيسة قبل الضبط — للعرض التشخيصي إن لزم */
  measuredLufs: number | null;
};

export async function masterAudio(blob: Blob): Promise<MasterResult> {
  const raw = await blob.arrayBuffer();
  const probe = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await probe.decodeAudioData(raw);
  } finally {
    await probe.close().catch(() => {});
  }

  const channelCount = Math.min(2, decoded.numberOfChannels);
  const rate = decoded.sampleRate;
  const datas = Array.from({ length: channelCount }, (_, c) => decoded.getChannelData(c));

  // حدود المحتوى المسموع (أقصى قيمة مطلقة عبر القنوات)
  let start = 0;
  let end = decoded.length - 1;
  const loudAt = (i: number) => datas.some((d) => Math.abs(d[i]) > SILENCE_THRESHOLD);
  while (start < end && !loudAt(start)) start++;
  while (end > start && !loudAt(end)) end--;

  const pad = Math.round(EDGE_PAD_SEC * rate);
  start = Math.max(0, start - pad);
  end = Math.min(decoded.length - 1, end + pad);
  const length = end - start + 1;
  if (length < rate) {
    // أقصر من ثانية بعد القص — ليس موسيقى فعلية، يعود الأصل بلا وسم معالجة
    return { blob, trimmedLeadSec: 0, changed: false, measuredLufs: null };
  }

  const channels = datas.map((d) => d.slice(start, end + 1));

  // ١) الجهارة: قياس متكامل ثم كسب نحو الهدف (برفع مقصوص يحمي شبه الصامت)
  const measuredLufs = integratedLufs(channels, rate);
  const gain = measuredLufs === null ? 1 : dbToLinear(gainToTarget(measuredLufs, TARGET_LUFS));
  if (gain !== 1) {
    for (const c of channels) {
      for (let i = 0; i < c.length; i++) c[i] *= gain;
    }
  }

  // ٢) الحواف: دخول قصير لا يوهن أول كلمة وخروج ناعم لا يبتر الذيل
  const fadeIn = Math.min(Math.round(FADE_IN_SEC * rate), Math.floor(length / 8));
  const fadeOut = Math.min(Math.round(FADE_OUT_SEC * rate), Math.floor(length / 8));
  for (const c of channels) {
    for (let i = 0; i < fadeIn; i++) c[i] *= i / fadeIn;
    for (let i = 0; i < fadeOut; i++) c[length - 1 - i] *= i / fadeOut;
  }

  // ٣) محدد الذروة — بعد الكسب كي يمسك ما دفعه الرفع فوق السقف
  limitPeaks(channels, rate, PEAK_CEILING);

  return {
    blob: new Blob([encodeWavStereo(channels, rate)], { type: "audio/wav" }),
    trimmedLeadSec: start / rate,
    changed: true,
    measuredLufs,
  };
}

/** ترميز WAV بعدد قنوات الملف (١ أو ٢) بعمق 16-bit */
function encodeWavStereo(channels: Float32Array[], rate: number): ArrayBuffer {
  const numCh = channels.length;
  const frames = Math.min(...channels.map((c) => c.length));
  const bytesPerFrame = numCh * 2;
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
  view.setUint16(22, numCh, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, frames * bytesPerFrame, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, Math.round(s * 32767), true);
      offset += 2;
    }
  }
  return out;
}
