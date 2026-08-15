/**
 * تصنيع فيديو يوتيوب من الأغنية — في المتصفح بالكامل:
 * لوحة Full HD 1920×1080 بهوية لحّن (غلاف الألبوم إن وُجد + العنوان + موجات متحركة
 * تتراقص مع الصوت عبر AnalyserNode)، تُسجَّل مع الصوت بMediaRecorder
 * إلى WebM جاهز للرفع. يوتيوب لا يقبل ملفات صوت — هذا هو الجسر.
 * التسجيل بزمن حقيقي (أغنية ٣ دقائق = ٣ دقائق تصنيع) والتقدم يُبلَّغ.
 */

export type SongVideoInput = {
  audioBlob: Blob;
  title: string;
  subtitle?: string;
  coverUrl?: string;
  onProgress?: (fraction: number) => void;
};

function pickMime(): string {
  const candidates = [
    'video/webm;codecs="vp9,opus"',
    'video/webm;codecs="vp8,opus"',
    "video/webm",
    "video/mp4",
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export async function renderSongVideo({
  audioBlob,
  title,
  subtitle = "",
  coverUrl,
  onProgress,
}: SongVideoInput): Promise<Blob> {
  const mime = pickMime();
  if (!mime) throw new Error("متصفحك لا يدعم تصنيع الفيديو — جرّب كروم أو سفاري حديثاً");

  // الغلاف (اختياري)
  let cover: HTMLImageElement | null = null;
  if (coverUrl) {
    cover = await new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = coverUrl;
    });
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080; // Full HD 1080p
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("تعذّر تهيئة لوحة الرسم");

  // الصوت: عنصر → محلل طيف → وجهة بث (لا يخرج للسماعات أثناء التصنيع)
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);
  audio.preload = "auto";
  const ac = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const src = ac.createMediaElementSource(audio);
  const analyser = ac.createAnalyser();
  analyser.fftSize = 128;
  const dest = ac.createMediaStreamDestination();
  src.connect(analyser);
  analyser.connect(dest);

  const stream = canvas.captureStream(30);
  dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };

  const bars = new Uint8Array(analyser.frequencyBinCount);
  let raf = 0;

  function draw() {
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    // خلفية متدرجة بهوية المنصة
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#3d1417");
    g.addColorStop(0.55, "#6b1f24");
    g.addColorStop(1, "#1d0a0c");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // الغلاف في المنتصف الأعلى
    const coverSize = 460;
    const coverX = (w - coverSize) / 2;
    const coverY = 130;
    if (cover) {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 36);
      ctx.clip();
      ctx.drawImage(cover, coverX, coverY, coverSize, coverSize);
      ctx.restore();
      ctx.strokeStyle = "rgba(212,175,55,.7)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 36);
      ctx.stroke();
    } else {
      // شعار لحّن: أعمدة نابضة داخل بطاقة
      ctx.fillStyle = "#c0453e";
      ctx.beginPath();
      ctx.roundRect(coverX, coverY, coverSize, coverSize, 36);
      ctx.fill();
      const t = performance.now() / 300;
      [0.35, 0.6, 0.42, 0.66].forEach((f, i) => {
        const bh = coverSize * f * (0.8 + 0.2 * Math.abs(Math.sin(t + i)));
        const bw2 = 26;
        const bx = coverX + coverSize / 2 - 2 * 44 + i * 44;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(bx, coverY + (coverSize - bh) / 2, bw2, bh, 13);
        ctx.fill();
      });
    }

    // العنوان
    ctx.textAlign = "center";
    ctx.fillStyle = "#fdf6ee";
    ctx.font = "bold 66px Cairo, Tajawal, sans-serif";
    ctx.fillText(title.slice(0, 60), w / 2, coverY + coverSize + 105);
    if (subtitle) {
      ctx.fillStyle = "rgba(253,246,238,.75)";
      ctx.font = "40px Cairo, Tajawal, sans-serif";
      ctx.fillText(subtitle.slice(0, 80), w / 2, coverY + coverSize + 168);
    }

    // موجات تتراقص مع الصوت
    analyser.getByteFrequencyData(bars);
    const n = 56;
    const bw = 20;
    const gap = (w - 240 - n * bw) / (n - 1);
    for (let i = 0; i < n; i++) {
      const v = bars[Math.floor((i / n) * bars.length)] / 255;
      const bh = 18 + v * 170;
      const x = 120 + i * (bw + gap);
      ctx.fillStyle = `rgba(212,175,55,${0.45 + v * 0.55})`;
      ctx.beginPath();
      ctx.roundRect(x, h - 90 - bh, bw, bh, 10);
      ctx.fill();
    }

    raf = requestAnimationFrame(draw);
  }

  return new Promise<Blob>((resolve, reject) => {
    const cleanup = () => {
      cancelAnimationFrame(raf);
      URL.revokeObjectURL(audioUrl);
      ac.close().catch(() => {});
    };
    recorder.onstop = () => {
      cleanup();
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (blob.size < 10_000) reject(new Error("خرج الفيديو فارغاً — أعد المحاولة"));
      else resolve(blob);
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error("تعطل مسجل الفيديو"));
    };
    audio.onended = () => {
      setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 300);
    };
    audio.ontimeupdate = () => {
      if (audio.duration) onProgress?.(Math.min(1, audio.currentTime / audio.duration));
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("تعذّرت قراءة الصوت"));
    };
    ac.resume()
      .then(() => {
        recorder.start(1000);
        draw();
        return audio.play();
      })
      .catch((e) => {
        cleanup();
        reject(e instanceof Error ? e : new Error("تعذّر بدء التصنيع"));
      });
  });
}
