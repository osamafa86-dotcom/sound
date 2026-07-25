/**
 * توليد ملفات WAV تجريبية على الخادم (وضع Mock قبل ربط مفاتيح الـ API).
 * يُستخدم لعزف سلّم المقام المختار بأرباع النغمات، أو نغمة تأكيد لقسم TTS.
 */

const SAMPLE_RATE = 44100;

/** تحويل درجة (بوحدة نصف النغمة من الأساس) إلى تردد بالهرتز */
export function degreeToFreq(tonicHz: number, semitones: number): number {
  return tonicHz * Math.pow(2, semitones / 12);
}

type Note = { freq: number; duration: number };

function renderNotes(notes: Note[]): Float32Array {
  const total = Math.ceil(notes.reduce((s, n) => s + n.duration, 0) * SAMPLE_RATE);
  const out = new Float32Array(total);
  let cursor = 0;

  for (const note of notes) {
    const len = Math.floor(note.duration * SAMPLE_RATE);
    const attack = Math.floor(len * 0.08);
    const release = Math.floor(len * 0.3);

    for (let i = 0; i < len && cursor + i < total; i++) {
      const t = i / SAMPLE_RATE;
      // أساس + هارمونيك ثانٍ خفيف لدفء الصوت (يقارب طابع الناي)
      const sample =
        0.7 * Math.sin(2 * Math.PI * note.freq * t) +
        0.2 * Math.sin(4 * Math.PI * note.freq * t) +
        0.06 * Math.sin(6 * Math.PI * note.freq * t);

      let env = 1;
      if (i < attack) env = i / attack;
      else if (i > len - release) env = (len - i) / release;

      out[cursor + i] += sample * env * 0.5;
    }
    cursor += len;
  }
  return out;
}

/**
 * تغليف بيانات PCM خام (16-bit little-endian) بترويسة WAV.
 * يُستخدم مع مخرجات pcm_44100 من ElevenLabs ومخرجات audio/L16 من Lyria.
 */
export function pcm16ToWav(pcm: Buffer, sampleRate = 44100, channels = 1): Buffer {
  const byteRate = sampleRate * channels * 2;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(channels * 2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function floatToWav(samples: Float32Array): Buffer {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buffer;
}

/** عزف سلّم المقام صعوداً ثم هبوطاً من درجة ري (D4) */
export function synthesizeMaqamScale(scale: number[], tempo = 1): Buffer {
  const tonic = 293.66; // D4 — درجة أساس شائعة في العزف الشرقي
  const up = scale.map((deg) => degreeToFreq(tonic, deg));
  const down = [...up].reverse().slice(1);
  const noteDur = 0.42 / tempo;

  const notes: Note[] = [...up, ...down].map((freq, i, arr) => ({
    freq,
    duration: i === arr.length - 1 ? noteDur * 2.2 : noteDur,
  }));
  return floatToWav(renderNotes(notes));
}

/** نغمة تأكيد قصيرة لقسم TTS في الوضع التجريبي */
export function synthesizeChime(): Buffer {
  const tonic = 440;
  const notes: Note[] = [0, 4, 7, 12].map((deg, i) => ({
    freq: degreeToFreq(tonic, deg),
    duration: i === 3 ? 0.55 : 0.22,
  }));
  return floatToWav(renderNotes(notes));
}
