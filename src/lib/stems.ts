/**
 * فصل المسارات والمزج — معالجة محلية في المتصفح بلا خوادم ولا كلفة:
 *
 * - النسخة الآلية (بلا غناء): الغناء يُمزج عادة في منتصف الصورة الستيريو،
 *   فطرح القناتين (إلغاء القناة الوسطى) يمحوه ويبقي الآلات الموزعة جانبياً.
 *   الترددات المنخفضة (الباص والإيقاع) تُمزج وسطاً هي الأخرى، فنعيدها من
 *   مزيج القناتين بعد ترشيحها كي لا يفقد المقطع امتلاءه.
 * - غناء المستخدم على اللحن: محاذاة زمنية تعوّض تأخير التسجيل + كسب للصوت
 *   + حماية من التشبع عند تجاوز الذروة.
 *
 * الرياضيات كلها دوال نقية على Float32Array قابلة للاختبار في Node،
 * وأغلفة فك الترميز والترميز الخاصة بالمتصفح في أسفل الملف.
 */

/** تردد الاحتفاظ بالباص: ما دونه يبقى من مزيج القناتين رغم إلغاء الوسط */
export const BASS_KEEP_HZ = 140;
/** سقف الذروة بعد المزج — يعادل ‎-0.2dBFS تقريباً */
const MIX_PEAK_LIMIT = 0.98;

/** مرشّح تمرير منخفض من مرحلتين (أحادي القطب × ٢ ≈ ‎12dB/أوكتاف) */
export function lowpass(input: Float32Array, sampleRate: number, cutoffHz: number): Float32Array {
  const alpha = 1 - Math.exp((-2 * Math.PI * cutoffHz) / sampleRate);
  const out = new Float32Array(input.length);
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < input.length; i++) {
    y1 += alpha * (input[i] - y1);
    y2 += alpha * (y1 - y2);
    out[i] = y2;
  }
  return out;
}

export type StereoSamples = { left: Float32Array; right: Float32Array };

/**
 * إلغاء القناة الوسطى: يزيل كل ما هو متطابق في القناتين (الغناء عادةً)
 * ويحتفظ بالمحتوى الجانبي كما هو، ويعيد الباص الأوسط المرشَّح كي يبقى الإيقاع.
 */
export function removeCenter(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bassKeepHz = BASS_KEEP_HZ
): StereoSamples {
  const n = Math.min(left.length, right.length);
  const mid = new Float32Array(n);
  for (let i = 0; i < n; i++) mid[i] = (left[i] + right[i]) / 2;
  const bass = lowpass(mid, sampleRate, bassKeepHz);

  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const side = (left[i] - right[i]) / 2;
    outL[i] = side + bass[i];
    outR[i] = -side + bass[i];
  }
  return { left: outL, right: outR };
}

export type MixOptions = {
  /** مضاعف علو صوت الغناء فوق الموسيقى (1 = كما سُجّل) */
  vocalGain?: number;
  /**
   * إزاحة الغناء داخل الخط الزمني بالثواني — القيمة السالبة تقدّمه
   * (تعويض تأخير الإخراج والإدخال أثناء التسجيل في المتصفح).
   */
  vocalOffsetSec?: number;
};

export type MixResult = StereoSamples & {
  /** true إذا خُفّض المزيج كاملاً لحمايته من التشبع */
  limited: boolean;
};

/** مزج غناء أحادي فوق موسيقى ستيريو — الناتج يتسع لذيل الغناء بعد نهاية الموسيقى */
export function mixVocalOverMusic(
  musicLeft: Float32Array,
  musicRight: Float32Array,
  vocal: Float32Array,
  sampleRate: number,
  opts: MixOptions = {}
): MixResult {
  const gain = Math.min(8, Math.max(0, opts.vocalGain ?? 1));
  const offset = Math.round((opts.vocalOffsetSec ?? 0) * sampleRate);
  const musicLen = Math.min(musicLeft.length, musicRight.length);
  const vocalEnd = vocal.length + offset;
  const n = Math.max(musicLen, vocalEnd, 1);

  const outL = new Float32Array(n);
  const outR = new Float32Array(n);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const j = i - offset;
    const v = j >= 0 && j < vocal.length ? vocal[j] * gain : 0;
    const l = (i < musicLen ? musicLeft[i] : 0) + v;
    const r = (i < musicLen ? musicRight[i] : 0) + v;
    outL[i] = l;
    outR[i] = r;
    const a = Math.max(Math.abs(l), Math.abs(r));
    if (a > peak) peak = a;
  }

  // حماية من التشبع: تخفيض شامل يحفظ التوازن بدل قصّ القمم
  const limited = peak > MIX_PEAK_LIMIT;
  if (limited) {
    const scale = MIX_PEAK_LIMIT / peak;
    for (let i = 0; i < n; i++) {
      outL[i] *= scale;
      outR[i] *= scale;
    }
  }
  return { left: outL, right: outR, limited };
}

/** ترميز WAV PCM 16-bit لقناة واحدة أو قناتين متشابكتين */
export function encodeWavPcm16(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const chans = channels.slice(0, 2);
  const numCh = chans.length;
  const frames = Math.min(...chans.map((c) => c.length));
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
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerFrame, true);
  view.setUint16(32, bytesPerFrame, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, frames * bytesPerFrame, true);

  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < numCh; c++) {
      const s = Math.max(-1, Math.min(1, chans[c][i]));
      view.setInt16(offset, Math.round(s * 32767), true);
      offset += 2;
    }
  }
  return out;
}

/* ------------------------- أغلفة المتصفح (Web Audio) ------------------------- */

type DecodedAudio = { channels: Float32Array[]; sampleRate: number };

/** فك ترميز عدة ملفات بسياق واحد — يضمن معدل عينات موحداً للمزج */
async function decodeAll(blobs: Blob[]): Promise<DecodedAudio[]> {
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const results: DecodedAudio[] = [];
    for (const blob of blobs) {
      const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
      results.push({
        channels: Array.from({ length: decoded.numberOfChannels }, (_, c) =>
          decoded.getChannelData(c).slice()
        ),
        sampleRate: decoded.sampleRate,
      });
    }
    return results;
  } finally {
    await ctx.close().catch(() => {});
  }
}

function toMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 1) return channels[0];
  const n = Math.min(...channels.map((c) => c.length));
  const out = new Float32Array(n);
  for (const c of channels) {
    for (let i = 0; i < n; i++) out[i] += c[i] / channels.length;
  }
  return out;
}

/** النسخة الآلية من أغنية مولّدة — WAV ستيريو بإلغاء القناة الوسطى */
export async function extractInstrumental(song: Blob): Promise<Blob> {
  const [music] = await decodeAll([song]);
  if (music.channels.length < 2) {
    throw new Error("الملف أحادي القناة — عزل الغناء محلياً يحتاج ملفاً ستيريو");
  }
  const { left, right } = removeCenter(music.channels[0], music.channels[1], music.sampleRate);
  return new Blob([encodeWavPcm16([left, right], music.sampleRate)], { type: "audio/wav" });
}

/** مزج تسجيل المستخدم فوق اللحن — الناتج WAV ستيريو جاهز للحفظ والمشاركة */
export async function mixSongWithVocal(
  music: Blob,
  vocal: Blob,
  opts: MixOptions = {}
): Promise<{ blob: Blob; limited: boolean }> {
  const [m, v] = await decodeAll([music, vocal]);
  const musicL = m.channels[0];
  const musicR = m.channels[1] ?? m.channels[0];
  const result = mixVocalOverMusic(musicL, musicR, toMono(v.channels), m.sampleRate, opts);
  return {
    blob: new Blob([encodeWavPcm16([result.left, result.right], m.sampleRate)], {
      type: "audio/wav",
    }),
    limited: result.limited,
  };
}
