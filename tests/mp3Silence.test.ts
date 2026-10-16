import { describe, expect, it } from "vitest";
import { firstMp3Frame, mp3Silence } from "@/lib/mp3Silence";

/**
 * الصمت الحقيقي بين أسطر الدراما: يُقرأ قالب الإطار من مقطع النطق نفسه،
 * ويُبنى الصمت إطارات بطول ثابت بلا CRC ولا حشو — ثُبت فكّه صمتاً تاماً
 * في ffmpeg وChromium عند كتابة الوحدة.
 */

/** إطار MPEG-1 Layer III: 192kbps، 44.1kHz، أحادي، بلا CRC */
const MPEG1_192 = Buffer.from([0xff, 0xfb, 0xb0, 0xc0]);

function segment(header: Buffer, frameBytes: number, frames = 3): Buffer {
  const one = Buffer.alloc(frameBytes, 0x55);
  header.copy(one, 0);
  return Buffer.concat(new Array(frames).fill(one));
}

describe("قراءة إطار MP3", () => {
  it("MPEG-1 بمعدل 192kbps: 626 بايتاً و1152 عينة عند 44.1kHz", () => {
    const f = firstMp3Frame(segment(MPEG1_192, 626))!;
    expect(f).not.toBeNull();
    expect(f.frameBytes).toBe(626);
    expect(f.samplesPerFrame).toBe(1152);
    expect(f.sampleRate).toBe(44100);
    expect([...f.header]).toEqual([0xff, 0xfb, 0xb0, 0xc0]);
  });

  it("القالب يُسقط بايت الحشو وCRC كي يثبت طول كل إطار صامت", () => {
    // حماية CRC مفعلة (0xFA) وبت الحشو مرفوع (0xB2)
    const f = firstMp3Frame(segment(Buffer.from([0xff, 0xfa, 0xb2, 0xc0]), 627))!;
    expect(f.header[1]).toBe(0xfb);
    expect(f.header[2]).toBe(0xb0);
    expect(f.frameBytes).toBe(626);
  });

  it("MPEG-2 بمعدل 64kbps: 208 بايتاً و576 عينة عند 22.05kHz", () => {
    const f = firstMp3Frame(segment(Buffer.from([0xff, 0xf3, 0x80, 0xc0]), 208))!;
    expect(f.frameBytes).toBe(208);
    expect(f.samplesPerFrame).toBe(576);
    expect(f.sampleRate).toBe(22050);
  });

  it("يتخطى وسم ID3v2 في رأس الملف", () => {
    // وسم بطول 20 بايتاً يحوي تزامناً كاذباً لا يُلتفت إليه
    const id3 = Buffer.concat([
      Buffer.from("ID3"),
      Buffer.from([4, 0, 0, 0, 0, 0, 20]),
      Buffer.from([0xff, 0xfb, 0xb0, 0xc0]),
      Buffer.alloc(16),
    ]);
    const f = firstMp3Frame(Buffer.concat([id3, segment(Buffer.from([0xff, 0xfb, 0x90, 0xc0]), 417)]))!;
    // 0x90: فهرس المعدل 9 = 128kbps — الإطار الحقيقي بعد الوسم لا الكاذب داخله
    expect(f.frameBytes).toBe(417);
  });

  it("ما ليس MP3 يعيد null بدل قالب خاطئ", () => {
    expect(firstMp3Frame(Buffer.from("RIFF....WAVEfmt "))).toBeNull();
    expect(firstMp3Frame(Buffer.alloc(0))).toBeNull();
    // تزامن بطبقة غير الثالثة (Layer II) لا يُقبل
    expect(firstMp3Frame(Buffer.from([0xff, 0xfd, 0xb0, 0xc0, 0, 0]))).toBeNull();
  });
});

describe("بناء الصمت", () => {
  const frame = firstMp3Frame(segment(MPEG1_192, 626))!;

  it("800ms ← 31 إطاراً (26.1ms للإطار) بترويسة القالب وصفر خالص بعدها", () => {
    const silence = mp3Silence(800, frame);
    expect(silence.length).toBe(31 * 626);
    for (let i = 0; i < 31; i++) {
      const f = silence.subarray(i * 626, (i + 1) * 626);
      expect([...f.subarray(0, 4)]).toEqual([0xff, 0xfb, 0xb0, 0xc0]);
      expect(f.subarray(4).every((b) => b === 0)).toBe(true);
    }
  });

  it("المدة بالبايت تطابق معدل البت — فحساب مدة العمل يبقى صحيحاً", () => {
    const silence = mp3Silence(3000, frame);
    expect(silence.length / (192_000 / 8)).toBeCloseTo(3, 1);
  });

  it("الصفر وما دون نصف إطار لا يضيفان شيئاً", () => {
    expect(mp3Silence(0, frame).length).toBe(0);
    expect(mp3Silence(10, frame).length).toBe(0);
  });
});
