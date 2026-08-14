"use client";

/**
 * مولد الأنمي — استوديو تحويل الخيال (أو الصور الحقيقية) إلى لوحات أنمي.
 * وضعان: «من الخيال» نصاً، و«حوّل صورتك» برفع صورة تُحوَّل بأسلوب أنمي
 * مع الحفاظ على الملامح والوقفة. هندسة البرومبت إنجليزية دقيقة لكل أسلوب،
 * ووصف المستخدم يبقى بالعربية — نماذج الصور تفهم المزيج جيداً.
 */

import { useEffect, useRef, useState } from "react";

type StyleDef = {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  prompt: string;
};

const STYLES: StyleDef[] = [
  {
    id: "shonen",
    name: "شونين حماسي",
    emoji: "⚔️",
    desc: "خطوط جريئة وحركة درامية — روح المغامرات",
    prompt:
      "dynamic shonen action anime style, bold energetic linework, dramatic motion and impact, high-contrast cel shading, vivid saturated colors",
  },
  {
    id: "dreamy",
    name: "خيال هادئ",
    emoji: "🌿",
    desc: "ألوان مائية دافئة ومشاهد ساحرة تلامس القلب",
    prompt:
      "soft painterly fantasy anime style, warm gentle sunlight, whimsical detailed scenery, watercolor-like lush backgrounds, heartfelt nostalgic atmosphere",
  },
  {
    id: "cyberpunk",
    name: "سايبربانك",
    emoji: "🌃",
    desc: "نيون وليل ممطر ومدينة مستقبلية",
    prompt:
      "cyberpunk anime style, neon-lit night city, rain reflections on streets, holographic signs, cinematic teal and magenta lighting, futuristic detail",
  },
  {
    id: "chibi",
    name: "تشيبي لطيف",
    emoji: "🧸",
    desc: "عيون كبيرة وقامة صغيرة وألوان باستيل",
    prompt:
      "cute chibi anime style, big sparkling eyes, small adorable body proportions, soft pastel colors, playful cheerful mood, clean simple background",
  },
  {
    id: "manga",
    name: "مانغا كلاسيك",
    emoji: "🖋️",
    desc: "أبيض وأسود بحبر وظلال شبكية",
    prompt:
      "black and white manga panel style, expressive ink lineart, screentone shading, dramatic composition, authentic japanese manga aesthetics",
  },
  {
    id: "portrait",
    name: "بورتريه مفصّل",
    emoji: "🎭",
    desc: "وجه معبّر بتفاصيل دقيقة وإضاءة استوديو",
    prompt:
      "highly detailed anime portrait, expressive luminous eyes, flowing detailed hair, soft studio lighting, shallow depth of field bokeh background",
  },
  {
    id: "epic",
    name: "فانتازيا ملحمية",
    emoji: "🐉",
    desc: "مشاهد ضخمة وسماء درامية وأزياء مزخرفة",
    prompt:
      "epic fantasy anime style, grand scale scenery, dramatic stormy sky, ornate detailed costumes, cinematic ultra-wide composition, awe-inspiring",
  },
  {
    id: "school",
    name: "مدرسي رومانسي",
    emoji: "🌸",
    desc: "ساعة ذهبية وأزهار كرز وأجواء شبابية",
    prompt:
      "slice-of-life romance anime style, japanese high school setting, golden hour warm light, cherry blossom petals in the air, tender youthful atmosphere",
  },
];

const ASPECTS = [
  { id: "square", name: "مربع", hint: "square 1:1 composition" },
  { id: "portrait", name: "طولي 9:16", hint: "vertical 9:16 portrait composition, full height framing" },
  { id: "wide", name: "سينمائي 16:9", hint: "wide 16:9 cinematic composition" },
] as const;

const MOODS = [
  { id: "", name: "بلا تحديد", hint: "" },
  { id: "sunset", name: "غروب 🌇", hint: "golden sunset lighting" },
  { id: "night", name: "ليل ونجوم 🌌", hint: "starry night, moonlight" },
  { id: "rain", name: "مطر ☔", hint: "rainy mood, wet reflections" },
  { id: "snow", name: "ثلج ❄️", hint: "gentle falling snow, winter light" },
  { id: "dawn", name: "فجر ضبابي 🌫️", hint: "misty dawn, soft fog" },
] as const;

const LOADING_LINES = [
  "🎨 الريشة تتحرك على الورق...",
  "✨ استدعاء روح الأنمي...",
  "🌸 نرسم البتلات واحدة واحدة...",
  "🖌️ تظليل العيون — أهم لحظة!",
  "⚡ لمسات الحبر الأخيرة...",
];

const BASE_QUALITY =
  "Professional anime illustration, masterpiece quality, clean precise lineart, rich harmonious colors, detailed background. No text, no watermark, no signature, no frames.";

type Creation = {
  url: string;
  kind: "image" | "video";
  /** المشهد المتصل: روابط المقاطع بترتيب التشغيل (الأول = url) */
  parts?: string[];
  styleName: string;
  brief: string;
  at: number;
};

const VIDEO_LOADING_LINES = [
  "🎬 تحريك الإطارات واحداً واحداً... (يأخذ ١-٣ دقائق)",
  "🌀 رسم ما بين الحركات (in-between frames)...",
  "🎥 ضبط حركة الكاميرا السينمائية...",
  "✨ نفخ الروح في المشهد...",
  "🍿 اللقطات الأخيرة — يستاهل الانتظار!",
];

const VIDEO_MOTION =
  "Smooth high-quality 2D anime animation, fluid natural character motion, flowing hair and clothes in the wind, subtle particle effects, cinematic camera movement, consistent character design across all frames.";

export default function AnimePage() {
  const [mode, setMode] = useState<"imagine" | "photo">("imagine");
  const [output, setOutput] = useState<"image" | "video">("image");
  const [vidDuration, setVidDuration] = useState<6 | 10 | 30 | 60>(6);
  const [styleId, setStyleId] = useState<string>(STYLES[0].id);
  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]["id"]>("square");
  const [mood, setMood] = useState<string>("");
  const [brief, setBrief] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loadingLine, setLoadingLine] = useState(LOADING_LINES[0]);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Creation | null>(null);
  const [galleryItems, setGalleryItems] = useState<Creation[]>([]);
  const loadingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const chainRef = useRef(""); // «المقطع ٢/٦» أثناء بناء المشهد المتصل
  const [partIdx, setPartIdx] = useState(0);

  // إعادة فهرس التشغيل عند تبديل النتيجة (نمط التعديل أثناء التصيير)
  const [lastResultAt, setLastResultAt] = useState(0);
  if ((result?.at ?? 0) !== lastResultAt) {
    setLastResultAt(result?.at ?? 0);
    setPartIdx(0);
  }

  // تحرير روابط الصور المؤقتة عند مغادرة الصفحة
  useEffect(() => {
    return () => {
      galleryItems.forEach((g) => {
        URL.revokeObjectURL(g.url);
        g.parts?.forEach((u) => u !== g.url && URL.revokeObjectURL(u));
      });
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** آخر إطار من مقطع فيديو كصورة JPEG — نقطة الوصل بين مقاطع المشهد المتصل */
  function lastFrameOf(blob: Blob): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.preload = "auto";
      v.src = URL.createObjectURL(blob);
      v.onloadedmetadata = () => {
        v.currentTime = Math.max(0, v.duration - 0.1);
      };
      v.onseeked = () => {
        const cv = document.createElement("canvas");
        cv.width = v.videoWidth;
        cv.height = v.videoHeight;
        cv.getContext("2d")?.drawImage(v, 0, 0);
        cv.toBlob(
          (b) => {
            URL.revokeObjectURL(v.src);
            if (b) resolve(b);
            else reject(new Error("تعذّر التقاط إطار الوصل"));
          },
          "image/jpeg",
          0.92
        );
      };
      v.onerror = () => {
        URL.revokeObjectURL(v.src);
        reject(new Error("تعذّر قراءة المقطع لاستخراج إطار الوصل"));
      };
    });
  }

  /** المشهد المتصل: مقاطع ١٠ ثوانٍ متسلسلة، كلٌّ يبدأ من آخر إطار في سابقه */
  async function generateChained(count: number): Promise<string[]> {
    const parts: string[] = [];
    let frame: Blob | null = mode === "photo" ? photo : null;
    for (let i = 0; i < count; i++) {
      chainRef.current = `🎞️ المقطع ${i + 1}/${count}`;
      setLoadingLine(`${chainRef.current} · ${VIDEO_LOADING_LINES[0]}`);
      const fd = new FormData();
      fd.append("mode", "video");
      fd.append(
        "prompt",
        buildPrompt() +
          `
This is part ${i + 1} of ${count} of ONE seamless continuous scene.` +
          (frame
            ? " Continue the exact same scene from the attached reference frame: same character, same environment, same art style — the motion flows naturally onward with no cut and no scene change."
            : "")
      );
      fd.append("durationSec", "10");
      fd.append("aspectRatio", aspect === "portrait" ? "9:16" : "16:9");
      if (frame) fd.append("image", frame, "frame.jpg");
      const res = await fetch("/api/studio/ai", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error ?? "تعذّر توليد المقطع";
        if (parts.length) {
          setError(`اكتمل ${parts.length} من ${count} مقاطع ثم توقف التوليد: ${msg}`);
          break;
        }
        throw new Error(msg);
      }
      const blob = await res.blob();
      parts.push(URL.createObjectURL(blob));
      if (i < count - 1) frame = await lastFrameOf(blob);
    }
    chainRef.current = "";
    return parts;
  }

  function pickPhoto(f: File | null) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(f);
    setPhotoPreview(f ? URL.createObjectURL(f) : "");
  }

  function buildPrompt(): string {
    const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];
    const aspectHint = ASPECTS.find((a) => a.id === aspect)?.hint ?? "";
    const moodHint = MOODS.find((m) => m.id === mood)?.hint ?? "";
    const parts = [
      mode === "photo"
        ? output === "video"
          ? "Animate the attached photo as an anime character brought to life, faithfully preserving the person's identity, facial features and composition."
          : "Transform the attached photo into an anime illustration, faithfully preserving the person's identity, facial features, pose and overall composition."
        : "",
      output === "video" ? VIDEO_MOTION : "",
      style.prompt,
      moodHint,
      aspectHint,
      BASE_QUALITY,
      brief.trim() ? `Scene description (in Arabic, follow it precisely): ${brief.trim()}` : "",
    ];
    return parts.filter(Boolean).join("\n");
  }

  async function generate() {
    if (busy) return;
    if (mode === "imagine" && !brief.trim()) {
      setError("اكتب وصف مشهدك أولاً — ولو بجملة واحدة");
      return;
    }
    if (mode === "photo" && !photo) {
      setError("ارفع صورتك أولاً لنحوّلها إلى أنمي");
      return;
    }
    setError("");
    setBusy(true);
    const lines = output === "video" ? VIDEO_LOADING_LINES : LOADING_LINES;
    let lineIdx = 0;
    setLoadingLine(lines[0]);
    chainRef.current = "";
    loadingTimer.current = setInterval(() => {
      lineIdx = (lineIdx + 1) % lines.length;
      setLoadingLine((chainRef.current ? chainRef.current + " · " : "") + lines[lineIdx]);
    }, output === "video" ? 6000 : 2600);

    try {
      // المشهد المتصل: سلسلة مقاطع تُبنى واحداً فوق آخر إطار من سابقه
      if (output === "video" && vidDuration >= 30) {
        const count = vidDuration === 30 ? 3 : 6;
        const parts = await generateChained(count);
        if (parts.length) {
          const creation: Creation = {
            url: parts[0],
            parts,
            kind: "video",
            styleName: STYLES.find((s) => s.id === styleId)?.name ?? "",
            brief: brief.trim() || "مشهد أنمي متصل",
            at: Date.now(),
          };
          setResult(creation);
          setGalleryItems((prev) => [creation, ...prev].slice(0, 24));
        }
        return;
      }

      const fd = new FormData();
      fd.append("mode", output);
      fd.append("prompt", buildPrompt());
      if (output === "video") {
        fd.append("durationSec", String(vidDuration));
        fd.append("aspectRatio", aspect === "portrait" ? "9:16" : "16:9");
      }
      if (mode === "photo" && photo) fd.append("image", photo, photo.name || "photo.jpg");
      const res = await fetch("/api/studio/ai", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "تعذّر التوليد — جرّب مجدداً بعد قليل");
      }
      const blob = await res.blob();
      const styleName = STYLES.find((s) => s.id === styleId)?.name ?? "";
      const creation: Creation = {
        url: URL.createObjectURL(blob),
        kind: output,
        styleName,
        brief: brief.trim() || (mode === "photo" ? "تحويل صورة إلى أنمي" : ""),
        at: Date.now(),
      };
      setResult(creation);
      setGalleryItems((prev) => [creation, ...prev].slice(0, 24));
    } catch (e) {
      setError(e instanceof Error ? e.message : "حدث خطأ غير متوقع");
    } finally {
      if (loadingTimer.current) clearInterval(loadingTimer.current);
      setBusy(false);
    }
  }

  function download(c: Creation) {
    const urls = c.parts ?? [c.url];
    urls.forEach((u, i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = u;
        a.download = `anime-${c.styleName}-${c.at}${urls.length > 1 ? `-${i + 1}` : ""}.${
          c.kind === "video" ? "mp4" : "png"
        }`;
        a.click();
      }, i * 500);
    });
  }

  const style = STYLES.find((s) => s.id === styleId) ?? STYLES[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* الترويسة */}
      <div className="text-center">
        <p className="text-4xl">🎌</p>
        <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">
          مولد <span className="text-gradient">الأنمي</span>
        </h1>
        <p className="mx-auto mt-3 max-w-2xl leading-relaxed text-muted">
          اكتب مشهدك بالعربية — أو ارفع صورتك الحقيقية — واختر أسلوبك الفني،
          واستلم لوحة أنمي احترافية أو فيديو أنمي متحركاً جاهزَين للتنزيل.
        </p>
      </div>

      {/* نوع الناتج: صورة أم فيديو */}
      <div className="mx-auto mt-8 flex max-w-md rounded-2xl border border-border-soft bg-surface-card p-1.5">
        {(
          [
            { id: "image", label: "🖼️ لوحة (صورة)" },
            { id: "video", label: "🎬 فيديو متحرك" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setOutput(t.id);
              if (t.id === "video" && aspect === "square") setAspect("wide");
            }}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              output === t.id ? "bg-primary text-white" : "text-muted hover:text-body"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* اختيار الوضع */}
      <div className="mx-auto mt-8 flex max-w-md rounded-2xl border border-border-soft bg-surface-card p-1.5">
        {(
          [
            { id: "imagine", label: "✨ من الخيال" },
            { id: "photo", label: "📸 حوّل صورتك" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
              mode === t.id ? "bg-primary text-white" : "text-muted hover:text-body"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* عمود الإعدادات */}
        <div className="space-y-6">
          {/* رفع الصورة — وضع التحويل */}
          {mode === "photo" && (
            <div className="rounded-3xl border border-border-soft bg-surface-card p-6">
              <h2 className="font-bold">صورتك الحقيقية</h2>
              <p className="mt-1 text-sm text-muted">
                تُحوَّل بأسلوب الأنمي مع الحفاظ على الملامح والوقفة — صور الوجه القريبة تعطي أجمل نتيجة.
              </p>
              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-soft bg-surface p-6 text-center transition-colors hover:border-primary">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoPreview} alt="صورتك" className="max-h-56 rounded-xl" />
                ) : (
                  <>
                    <span className="text-3xl">📤</span>
                    <span className="text-sm font-semibold">اضغط لرفع صورة (حتى 15MB)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
              {photo && (
                <button onClick={() => pickPhoto(null)} className="mt-2 text-xs text-muted hover:text-primary">
                  ✖ إزالة الصورة
                </button>
              )}
            </div>
          )}

          {/* الوصف */}
          <div className="rounded-3xl border border-border-soft bg-surface-card p-6">
            <h2 className="font-bold">{mode === "photo" ? "لمسات إضافية (اختياري)" : "صف مشهدك"}</h2>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              maxLength={1500}
              placeholder={
                mode === "photo"
                  ? "مثال: اجعل الخلفية شوارع طوكيو ليلاً، وأضف معطفاً طويلاً..."
                  : "مثال: فارس شاب يقف على قمة جبل وقت الغروب، عباءته تتطاير مع الريح، وتنين يحلّق خلف الغيوم..."
              }
              className="mt-3 w-full resize-y rounded-xl border border-border-soft bg-surface p-4 leading-relaxed outline-none transition-colors focus:border-primary"
            />
          </div>

          {/* الأساليب */}
          <div className="rounded-3xl border border-border-soft bg-surface-card p-6">
            <h2 className="font-bold">الأسلوب الفني</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className={`rounded-2xl border p-3 text-center transition-all ${
                    styleId === s.id
                      ? "border-primary bg-rose shadow-md"
                      : "border-border-soft bg-surface hover:border-primary/50"
                  }`}
                >
                  <span className="text-2xl">{s.emoji}</span>
                  <p className="mt-1 text-sm font-bold">{s.name}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">{s.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* الأبعاد والمزاج */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-3xl border border-border-soft bg-surface-card p-6">
              <h2 className="text-sm font-bold">الأبعاد</h2>
              <div className="mt-3 flex flex-col gap-2">
                {ASPECTS.filter((a) => output === "image" || a.id !== "square").map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAspect(a.id)}
                    className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                      aspect === a.id ? "border-primary bg-rose text-primary" : "border-border-soft text-muted hover:text-body"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-border-soft bg-surface-card p-6">
              {output === "video" && (
                <div className="mb-5">
                  <h2 className="text-sm font-bold">مدة الفيديو</h2>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        { d: 6, l: "٦ ثوانٍ" },
                        { d: 10, l: "١٠ ثوانٍ" },
                        { d: 30, l: "٣٠ ث · مشهد متصل" },
                        { d: 60, l: "دقيقة · مشهد متصل" },
                      ] as const
                    ).map(({ d, l }) => (
                      <button
                        key={d}
                        onClick={() => setVidDuration(d)}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                          vidDuration === d ? "border-primary bg-rose text-primary" : "border-border-soft text-muted hover:text-body"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  {vidDuration >= 30 && (
                    <p className="mt-2 text-[11px] leading-relaxed text-muted">
                      🎞️ يُبنى من مقاطع ١٠ ثوانٍ متسلسلة — كل مقطع يبدأ من آخر إطار في سابقه
                      فيبدو مشهداً واحداً متواصلاً. التوليد يأخذ {vidDuration === 30 ? "٥-١٠" : "١٠-٢٠"} دقيقة.
                    </p>
                  )}
                </div>
              )}
              <h2 className="text-sm font-bold">الإضاءة والمزاج</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {MOODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      mood === m.id ? "border-primary bg-rose text-primary" : "border-border-soft text-muted hover:text-body"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* زر التوليد */}
          <button
            onClick={generate}
            disabled={busy}
            className="w-full rounded-2xl bg-primary py-4 text-lg font-extrabold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong disabled:opacity-60"
          >
            {busy ? loadingLine : output === "video" ? `🎬 ولّد فيديو ${style.name}` : `🎨 ولّد لوحة ${style.name}`}
          </button>
          {error && <p className="text-center text-sm font-semibold text-primary-strong">{error}</p>}
        </div>

        {/* عمود النتيجة */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-gold/30 bg-surface-card p-6">
            <h2 className="font-bold">اللوحة</h2>
            {result ? (
              <>
                {result.kind === "video" ? (
                  <>
                    <video
                      key={result.at + "-" + partIdx}
                      src={result.parts ? result.parts[partIdx] : result.url}
                      controls
                      autoPlay
                      loop={!result.parts || result.parts.length === 1}
                      playsInline
                      onEnded={() => {
                        if (result.parts && result.parts.length > 1) {
                          setPartIdx((i) => (i + 1) % result.parts!.length);
                        }
                      }}
                      className="mt-4 w-full rounded-2xl border border-border-soft"
                    />
                    {result.parts && result.parts.length > 1 && (
                      <p className="mt-1 text-center text-xs font-semibold text-muted">
                        🎞️ مشهد متصل — المقطع {partIdx + 1} من {result.parts.length} (يتابع تلقائياً)
                      </p>
                    )}
                  </>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.url}
                    alt={result.brief || "لوحة أنمي"}
                    className="mt-4 w-full rounded-2xl border border-border-soft"
                  />
                )}
                <p className="mt-2 text-xs text-muted">
                  {result.styleName}
                  {result.brief ? ` — ${result.brief.slice(0, 80)}` : ""}
                </p>
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => download(result)}
                    className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-strong"
                  >
                    ⬇️ تنزيل
                  </button>
                  <button
                    onClick={generate}
                    disabled={busy}
                    className="flex-1 rounded-xl border border-primary px-4 py-2.5 text-sm font-bold text-primary transition-colors hover:bg-rose disabled:opacity-50"
                  >
                    🔄 نسخة أخرى
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-4 flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-border-soft text-center text-sm text-muted">
                {busy ? (
                  <span className="animate-pulse px-6">{loadingLine}</span>
                ) : (
                  <span className="px-6">لوحتك ستظهر هنا ✨</span>
                )}
              </div>
            )}
          </div>

          {/* معرض الجلسة */}
          {galleryItems.length > 1 && (
            <div className="rounded-3xl border border-border-soft bg-surface-card p-6">
              <h2 className="text-sm font-bold">أعمال هذه الجلسة</h2>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {galleryItems.map((g) => (
                  <button key={g.at} onClick={() => setResult(g)} title={g.brief} className="group relative">
                    {g.kind === "video" ? (
                      <video
                        src={g.url}
                        muted
                        playsInline
                        preload="metadata"
                        className={`aspect-square w-full rounded-xl object-cover transition-all ${
                          result?.at === g.at ? "ring-2 ring-primary" : "opacity-80 group-hover:opacity-100"
                        }`}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.url}
                        alt={g.brief || g.styleName}
                        className={`aspect-square w-full rounded-xl object-cover transition-all ${
                          result?.at === g.at ? "ring-2 ring-primary" : "opacity-80 group-hover:opacity-100"
                        }`}
                      />
                    )}
                    {g.kind === "video" && (
                      <span className="absolute bottom-1 end-1 rounded bg-body/60 px-1 text-[10px] text-white">🎬</span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted">💡 نزّل ما يعجبك — المعرض يُمسح عند إغلاق الصفحة</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
