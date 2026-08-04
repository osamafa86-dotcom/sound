/**
 * معاينة المقام الحية — نواة نقية لجلسات Lyria RealTime:
 * بناء البرومبتات الموزونة وإعدادات التوليد من اختيارات المستخدم
 * (المقام، الإيقاع، الحيوية) — قابلة للاختبار في Node، وأغلفة
 * الاتصال الفعلي (WebSocket عبر @google/genai) في مكوّن الواجهة.
 */

export const LIVE_MODEL = "models/lyria-realtime-exp";
export const LIVE_BPM_MIN = 60;
export const LIVE_BPM_MAX = 140;
/** سقف الجلسة بالثواني — الزائر أقصر (تذوق) والمسجل أطول */
export const LIVE_CAP_GUEST_SEC = 60;
export const LIVE_CAP_MEMBER_SEC = 150;

export type WeightedPrompt = { text: string; weight: number };

export type LiveJamOptions = {
  bpm: number;
  /** 0..1 — من تأملي هادئ إلى راقص مندفع */
  intensity: number;
  /** أسماء آلات بالإنجليزية (اختياري — من اختيارات المستخدم) */
  instrumentsEn?: string[];
};

export function clampBpm(v: number): number {
  if (!Number.isFinite(v)) return 90;
  return Math.min(LIVE_BPM_MAX, Math.max(LIVE_BPM_MIN, Math.round(v)));
}

function clamp01(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5;
}

/**
 * البرومبتات الموزونة للجلسة: هوية المقام دائماً بوزن كامل،
 * والآلات إن اختيرت، وقطبا الطاقة يتوازنان حسب الحيوية —
 * تغيير الأوزان أثناء العزف يصنع انتقالاً موسيقياً حياً.
 */
export function buildWeightedPrompts(
  maqam: { stylePrompt: string },
  opts: LiveJamOptions
): WeightedPrompt[] {
  const intensity = clamp01(opts.intensity);
  const prompts: WeightedPrompt[] = [{ text: maqam.stylePrompt, weight: 1 }];

  if (opts.instrumentsEn?.length) {
    prompts.push({ text: opts.instrumentsEn.slice(0, 6).join(", "), weight: 0.6 });
  }
  if (intensity > 0.05) {
    prompts.push({
      text: "energetic driving rhythm, rich Arabic ornamentation, full ensemble",
      weight: Math.round(intensity * 100) / 100,
    });
  }
  if (intensity < 0.95) {
    prompts.push({
      text: "calm meditative taqsim, sparse intimate arrangement",
      weight: Math.round((1 - intensity) * 100) / 100,
    });
  }
  return prompts;
}

/** إعدادات التوليد الحية — قيم مضبوطة ضمن مدى الواجهة الموثق */
export function buildMusicConfig(opts: LiveJamOptions): Record<string, number> {
  const intensity = clamp01(opts.intensity);
  return {
    bpm: clampBpm(opts.bpm),
    density: Math.round(intensity * 100) / 100,
    brightness: Math.round((0.35 + 0.45 * intensity) * 100) / 100,
  };
}

/** تحويل قطعة PCM16 متشابكة (ستيريو 48kHz) إلى قناتي Float32 للتشغيل */
export function pcm16ChunkToStereo(bytes: Uint8Array): {
  left: Float32Array<ArrayBuffer>;
  right: Float32Array<ArrayBuffer>;
} {
  const samples = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  const frames = Math.floor(samples.length / 2);
  const left = new Float32Array(frames);
  const right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    left[i] = samples[2 * i] / 32768;
    right[i] = samples[2 * i + 1] / 32768;
  }
  return { left, right };
}
