/**
 * قياس الجهارة والحد من الذروة — رياضيات نقية على Float32Array (تعمل في Node والمتصفح).
 *
 * المقياس وفق ITU-R BS.1770-4 (معيار البث وEBU R128 ومنصات النشر):
 * ترشيح K (رف عالٍ + تمرير عالٍ) ثم متوسط مربعات على نوافذ 400م‌ث متداخلة
 * مع بوابتين (مطلقة -70 ونسبية -10) — الناتج LUFS متكامل كما تقيسه Spotify
 * وYouTube. وعليه يُضبط الكسب نحو الهدف، وlimiter بنظرة أمامية يمسك القمم.
 */

/** هدف الجهارة الافتراضي — عرف منصات البث (-14 LUFS) */
export const TARGET_LUFS = -14;
/** سقف الذروة الحقيقية التقريبي (-1 dBFS) */
export const PEAK_CEILING = 0.891;
/** أقصى رفع مسموح — حماية من تضخيم مقاطع شبه صامتة */
export const MAX_BOOST_DB = 12;

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number };

/** رف عالٍ وفق مواصفة BS.1770 بصيغ RBJ — يعمل على أي معدل عينات */
function highShelf(rate: number, f0: number, gainDb: number, q: number): Biquad {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / rate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const twoSqrtAAlpha = 2 * Math.sqrt(A) * alpha;
  const a0 = A + 1 - (A - 1) * cos + twoSqrtAAlpha;
  return {
    b0: (A * (A + 1 + (A - 1) * cos + twoSqrtAAlpha)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos - twoSqrtAAlpha)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos)) / a0,
    a2: (A + 1 - (A - 1) * cos - twoSqrtAAlpha) / a0,
  };
}

function highPass(rate: number, f0: number, q: number): Biquad {
  const w0 = (2 * Math.PI * f0) / rate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

function applyBiquad(input: Float32Array, c: Biquad): Float32Array {
  const out = new Float32Array(input.length);
  let x1 = 0,
    x2 = 0,
    y1 = 0,
    y2 = 0;
  for (let i = 0; i < input.length; i++) {
    const x = input[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    out[i] = y;
  }
  return out;
}

/** ترشيح K: رف عالٍ (+4dB حول 1681Hz) ثم تمرير عالٍ (38Hz) — ثوابت BS.1770 */
export function kWeight(channel: Float32Array, rate: number): Float32Array {
  const shelf = highShelf(rate, 1681.9744509555319, 3.99984385397399, 0.7071752369554196);
  const hp = highPass(rate, 38.13547087602444, 0.5003270373238773);
  return applyBiquad(applyBiquad(channel, shelf), hp);
}

/**
 * الجهارة المتكاملة بالبوابتين — null لمقطع أقصر من نافذة أو صامت فعلياً.
 * قنوات اليسار واليمين بوزن 1 (لا قنوات محيطية هنا).
 */
export function integratedLufs(channels: Float32Array[], rate: number): number | null {
  const n = Math.min(...channels.map((c) => c.length));
  const block = Math.round(0.4 * rate);
  const hop = Math.round(0.1 * rate);
  if (n < block) return null;

  const weighted = channels.map((c) => kWeight(c.subarray(0, n), rate));

  // متوسط مربعات كل نافذة عبر مجموع تراكمي — O(n) لكل قناة
  const blockPowers: number[] = [];
  const prefix = weighted.map((w) => {
    const p = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) p[i + 1] = p[i] + w[i] * w[i];
    return p;
  });
  for (let start = 0; start + block <= n; start += hop) {
    let sum = 0;
    for (const p of prefix) sum += (p[start + block] - p[start]) / block;
    blockPowers.push(sum);
  }

  const loudness = (p: number) => -0.691 + 10 * Math.log10(p);
  // البوابة المطلقة -70 LUFS
  const above = blockPowers.filter((p) => p > 0 && loudness(p) > -70);
  if (!above.length) return null;
  // البوابة النسبية: -10 دون متوسط ما تجاوز المطلقة
  const relThreshold = loudness(above.reduce((a, b) => a + b, 0) / above.length) - 10;
  const gated = above.filter((p) => loudness(p) > relThreshold);
  if (!gated.length) return null;
  return loudness(gated.reduce((a, b) => a + b, 0) / gated.length);
}

/** كسب الوصول للهدف بالديسيبل — مقصوص برفع أقصى يحمي شبه الصامت */
export function gainToTarget(currentLufs: number, targetLufs = TARGET_LUFS): number {
  return Math.min(MAX_BOOST_DB, targetLufs - currentLufs);
}

export function dbToLinear(db: number): number {
  return Math.pow(10, db / 20);
}

/**
 * محدد ذروة بنظرة أمامية (ستيريو موحّد): يخفض الكسب لحظة القمة قبل وصولها
 * (نافذة ~5م‌ث بحد أدنى انزلاقي O(n)) ويعود بهدوء (~50م‌ث) — بلا قصّ صلب.
 * يعدّل القنوات في مكانها ويعيد true إن حدث أي حد.
 */
export function limitPeaks(
  channels: Float32Array[],
  rate: number,
  ceiling = PEAK_CEILING
): boolean {
  const n = Math.min(...channels.map((c) => c.length));
  const look = Math.max(1, Math.round(0.005 * rate));
  const releasePerSample = 1 / (0.05 * rate);

  // أقصى قيمة مطلقة عبر القنوات لكل عينة
  const mag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (const c of channels) {
      const v = Math.abs(c[i]);
      if (v > m) m = v;
    }
    mag[i] = m;
  }

  // حد أقصى انزلاقي على نافذة النظرة الأمامية (deque رتيب بمؤشر إدخال مستقل)
  const deque: number[] = [];
  let nextInsert = 0;
  let limited = false;
  let gain = 1;
  for (let i = 0; i < n; i++) {
    const windowEnd = Math.min(n - 1, i + look - 1);
    for (; nextInsert <= windowEnd; nextInsert++) {
      while (deque.length && mag[deque[deque.length - 1]] <= mag[nextInsert]) deque.pop();
      deque.push(nextInsert);
    }
    while (deque.length && deque[0] < i) deque.shift();

    const peak = deque.length ? mag[deque[0]] : 0;
    const target = peak > ceiling ? ceiling / peak : 1;
    // هجوم فوري (النظرة الأمامية تتكفل بالنعومة الزمنية) وعودة تدريجية
    gain = target < gain ? target : Math.min(1, gain + releasePerSample);
    if (gain < 1) {
      limited = true;
      for (const c of channels) c[i] *= gain;
    }
  }
  return limited;
}
