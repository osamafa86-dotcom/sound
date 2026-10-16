/**
 * صمت MP3 حقيقي بإطارات صامتة — بديل وسم <break> الذي لا يفهمه الجيلان
 * الثالث والرابع من ElevenLabs (الوقفات عندهما وسوم تقريبية لا مدد دقيقة).
 *
 * الإطار الصامت: ترويسة مطابقة لإطارات المقطع نفسه (المعدل والتردد والقنوات)
 * يليها صفر خالص — معلومات جانبية صفرية تعني «لا بيانات طيفية» فيفكّه أي
 * مشغل صمتاً تاماً، ويُلصق بين المقاطع كما تُلصق المقاطع نفسها. الدقة إطار
 * واحد (~26ms عند 44.1kHz) وهي دون ما تميّزه الأذن في إيقاع الحوار.
 */

/** معدلات Layer III بالكيلوبت — MPEG-1 ثم MPEG-2/2.5 */
const BITRATES_V1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BITRATES_V2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

/** الترددات حسب بتي الإصدار: 3 = MPEG-1، 2 = MPEG-2، 0 = MPEG-2.5 */
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

export type Mp3FrameInfo = {
  /** ترويسة الإطار بلا حشو وبلا CRC — قالب الإطارات الصامتة */
  header: Buffer;
  frameBytes: number;
  samplesPerFrame: number;
  sampleRate: number;
};

/** طول وسم ID3v2 في رأس الملف إن وُجد — ليبدأ البحث عن الإطار بعده */
function id3Length(buf: Buffer): number {
  if (buf.length < 10 || buf.toString("latin1", 0, 3) !== "ID3") return 0;
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  const footer = buf[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

/** أول إطار Layer III صالح في المقطع — null إن لم يكن MP3 مفهوماً */
export function firstMp3Frame(buf: Buffer): Mp3FrameInfo | null {
  for (let i = id3Length(buf); i + 4 <= buf.length; i++) {
    if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;

    const version = (buf[i + 1] >> 3) & 0x03;
    const layer = (buf[i + 1] >> 1) & 0x03;
    const bitrateIndex = (buf[i + 2] >> 4) & 0x0f;
    const rateIndex = (buf[i + 2] >> 2) & 0x03;
    // إصدار محجوز، أو ليس Layer III، أو معدل/تردد غير صالح: تزامن كاذب
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) {
      continue;
    }

    const mpeg1 = version === 3;
    const kbps = (mpeg1 ? BITRATES_V1 : BITRATES_V2)[bitrateIndex];
    const sampleRate = SAMPLE_RATES[version][rateIndex];
    const samplesPerFrame = mpeg1 ? 1152 : 576;
    const frameBytes = Math.floor(((mpeg1 ? 144_000 : 72_000) * kbps) / sampleRate);

    const header = Buffer.from(buf.subarray(i, i + 4));
    header[1] |= 0x01; // بلا CRC — فلا حاجة لبايتي تحقق بعد الترويسة
    header[2] &= ~0x02; // بلا بايت حشو — طول ثابت لكل إطار صامت
    return { header, frameBytes, samplesPerFrame, sampleRate };
  }
  return null;
}

/** صمت بالمدة المطلوبة (مقرّبة لأقرب إطار) بصيغة إطارات المقطع نفسه */
export function mp3Silence(durationMs: number, frame: Mp3FrameInfo): Buffer {
  const frames = Math.round((durationMs / 1000) * (frame.sampleRate / frame.samplesPerFrame));
  if (frames <= 0) return Buffer.alloc(0);

  const one = Buffer.alloc(frame.frameBytes);
  frame.header.copy(one, 0);
  return Buffer.concat(new Array(frames).fill(one));
}
