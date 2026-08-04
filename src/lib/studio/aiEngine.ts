/**
 * محرك بطاقة «ذكاء مقام» الشاملة — ثلاثة أوضاع على واجهات Gemini:
 * نص (فهم متعدد الوسائط: يقرأ نصوصاً ويسمع أصواتاً ويرى صوراً وفيديو معاً)،
 * صورة (سلسلة نماذج الصور نفسها المستخدمة للأغلفة)،
 * وفيديو (Veo بعملية طويلة الأمد مع استعلام دوري).
 *
 * «التغذية الجمعية»: كل المواد الواصلة من البطاقات الموصولة تُحقن
 * في الطلب الواحد — فتتفاعل البطاقة مع مشروع المساحة كله لا مع مدخل واحد.
 */

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const TEXT_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.6-flash";
const IMAGE_MODELS = [
  process.env.GEMINI_IMAGE_MODEL ?? "gemini-3.1-flash-image",
  "gemini-2.5-flash-image",
];
const VEO_MODEL = process.env.VEO_MODEL ?? "veo-3.1-fast-generate-preview";

export type AiMedia = { data: Buffer; mimeType: string };

export type AiContext = {
  texts: string[];
  audios: AiMedia[];
  images: AiMedia[];
  videos: AiMedia[];
};

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

const inlinePart = (m: AiMedia): Part => ({
  inlineData: { mimeType: m.mimeType, data: m.data.toString("base64") },
});

/** نصوص البطاقات الموصولة ككتلة واحدة مرقمة — ترتيب الوصل يحدد الترتيب */
function textsBlock(texts: string[]): string {
  if (!texts.length) return "";
  return `\n\nمواد نصية واصلة من بطاقات المساحة الموصولة:\n${texts
    .map((t, i) => `«المادة ${i + 1}»:\n${t}`)
    .join("\n\n")}`;
}

async function callGemini(
  apiKey: string,
  model: string,
  parts: Part[],
  modalities: ("TEXT" | "IMAGE")[]
): Promise<Response> {
  return fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: modalities },
    }),
  });
}

/** الوضع النصي: توجيه المستخدم + كل مواد التغذية الجمعية في طلب واحد */
export async function aiText(apiKey: string, prompt: string, ctx: AiContext): Promise<string> {
  const instruction = [
    "أنت «ذكاء مقام» — عقل إبداعي داخل مساحة عمل بصرية لمنصة صوتية عربية.",
    "تصلك مواد من بطاقات موصولة (نصوص وأصوات وصور وفيديو) وتوجيه من المستخدم.",
    "نفّذ التوجيه على المواد الواصلة وأعد الناتج المطلوب نفسه فقط:",
    "بلا مقدمات ولا خواتيم ولا شروح، وبالعربية ما لم يطلب المستخدم غير ذلك.",
    `\nتوجيه المستخدم:\n${prompt}`,
    textsBlock(ctx.texts),
    ctx.audios.length || ctx.images.length || ctx.videos.length
      ? "\nوالمواد السمعية والبصرية الواصلة مرفقة مع هذه الرسالة."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Part[] = [
    { text: instruction },
    ...ctx.audios.map(inlinePart),
    ...ctx.images.map(inlinePart),
    ...ctx.videos.map(inlinePart),
  ];

  const res = await callGemini(apiKey, TEXT_MODEL, parts, ["TEXT"]);
  if (!res.ok) {
    throw new Error(`Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  }
  const json = await res.json();
  const text = (json?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("لم يُعد الذكاء نصاً — جرّب صياغة أوضح");
  return text;
}

/** وضع الصورة: التوجيه والنصوص برومبتاً واحداً، والصور الواصلة مرجعاً بصرياً */
export async function aiImage(apiKey: string, prompt: string, ctx: AiContext): Promise<AiMedia> {
  const fullPrompt = [
    prompt,
    textsBlock(ctx.texts),
    ctx.images.length ? "استرشد بالصور المرفقة مرجعاً بصرياً للأسلوب والروح." : "",
  ]
    .filter(Boolean)
    .join("\n");

  const parts: Part[] = [{ text: fullPrompt }, ...ctx.images.map(inlinePart)];

  let lastError = "";
  for (const model of IMAGE_MODELS) {
    const res = await callGemini(apiKey, model, parts, ["IMAGE"]);
    if (!res.ok) {
      lastError = `Gemini ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
      // نموذج غير متاح لهذا المفتاح — جرّب التالي في السلسلة
      if (res.status === 404 || res.status === 400) continue;
      throw new Error(lastError);
    }
    const json = await res.json();
    for (const part of json?.candidates?.[0]?.content?.parts ?? []) {
      const mime = part?.inlineData?.mimeType ?? "";
      if (part?.inlineData?.data && mime.startsWith("image/")) {
        return { data: Buffer.from(part.inlineData.data, "base64"), mimeType: mime };
      }
    }
    lastError = "استجابة بلا صورة";
  }
  throw new Error(lastError || "تعذّر توليد الصورة");
}

export type VideoOptions = {
  /** 4 أو 6 أو 8 ثوانٍ حسب دعم النموذج */
  durationSec?: number;
  aspectRatio?: "16:9" | "9:16";
};

const HAILUO_MODEL = process.env.MINIMAX_VIDEO_MODEL ?? "MiniMax-Hailuo-02";
const HAILUO_RESOLUTION = process.env.MINIMAX_VIDEO_RES ?? "768P";

/**
 * فيديو Hailuo (MiniMax) — محرك الفيديو الأول للمنصة: يعمل برصيد
 * الدفع-حسب-الاستخدام المشحون فعلاً، بينما Veo يتطلب فوترة Google.
 * مسار مهمة: إنشاء ← استعلام دوري ← جلب رابط الملف ← تنزيل.
 * أول صورة واصلة تصبح الإطار الافتتاحي (صورة ← فيديو).
 */
export async function hailuoVideo(
  apiKey: string,
  groupId: string,
  prompt: string,
  ctx: AiContext,
  opts: VideoOptions = {}
): Promise<AiMedia> {
  const fullPrompt = [prompt, textsBlock(ctx.texts)].filter(Boolean).join("\n").slice(0, 2000);
  const firstImage = ctx.images[0];
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };
  const gid = encodeURIComponent(groupId);

  const createRes = await fetch(`https://api.minimax.io/v1/video_generation?GroupId=${gid}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: HAILUO_MODEL,
      prompt: fullPrompt,
      // المحرك يدعم 6 أو 10 ثوانٍ — نقرّب اختيار المستخدم لأقرب مدة
      duration: (opts.durationSec ?? 6) >= 8 ? 10 : 6,
      resolution: HAILUO_RESOLUTION,
      ...(firstImage && {
        first_frame_image: `data:${firstImage.mimeType};base64,${firstImage.data.toString("base64")}`,
      }),
    }),
  });
  const created = await createRes.json().catch(() => null);
  const createCode: number = created?.base_resp?.status_code ?? -1;
  if (!createRes.ok || createCode !== 0 || !created?.task_id) {
    const msg: string = created?.base_resp?.status_msg ?? `HTTP ${createRes.status}`;
    throw new Error(
      /insufficient balance/i.test(msg)
        ? "توليد الفيديو يتطلب رصيداً في محفظة MiniMax (قسم Balance) — اشحنها ثم أعد المحاولة"
        : `Hailuo: ${msg}`
    );
  }

  // الاستعلام الدوري — 768P لست ثوانٍ يكتمل خلال دقيقة إلى دقيقتين عادة
  let fileId = "";
  for (let attempt = 0; attempt < 24 && !fileId; attempt++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const st = await fetch(
      `https://api.minimax.io/v1/query/video_generation?task_id=${encodeURIComponent(created.task_id)}`,
      { headers }
    )
      .then((r) => r.json())
      .catch(() => null);
    const status: string = st?.status ?? "";
    if (status === "Success" && st?.file_id) fileId = String(st.file_id);
    else if (status === "Fail") {
      throw new Error(`Hailuo: فشل التوليد${st?.base_resp?.status_msg ? ` (${st.base_resp.status_msg})` : ""}`);
    }
  }
  if (!fileId) throw new Error("انتهت مهلة توليد الفيديو — حاول مجدداً");

  const file = await fetch(
    `https://api.minimax.io/v1/files/retrieve?GroupId=${gid}&file_id=${encodeURIComponent(fileId)}`,
    { headers }
  )
    .then((r) => r.json())
    .catch(() => null);
  const url: string | undefined = file?.file?.download_url;
  if (!url) throw new Error("لم يُعد Hailuo رابط الفيديو");

  const download = await fetch(url);
  if (!download.ok) throw new Error(`تعذّر تنزيل الفيديو (${download.status})`);
  return {
    data: Buffer.from(await download.arrayBuffer()),
    mimeType: download.headers.get("Content-Type")?.split(";")[0] || "video/mp4",
  };
}

type VeoOperation = {
  name?: string;
  done?: boolean;
  error?: { message?: string };
  response?: {
    generateVideoResponse?: {
      generatedSamples?: { video?: { uri?: string } }[];
      raiMediaFilteredCount?: number;
    };
    generatedVideos?: { video?: { uri?: string; videoBytes?: string } }[];
  };
};

/**
 * وضع الفيديو: Veo عملية طويلة الأمد — إنشاء ثم استعلام دوري حتى الاكتمال.
 * أول صورة واصلة تصبح الإطار الافتتاحي (صورة ← فيديو)، والنصوص تُدمج بالتوجيه.
 */
export async function aiVideo(
  apiKey: string,
  prompt: string,
  ctx: AiContext,
  opts: VideoOptions = {}
): Promise<AiMedia> {
  const fullPrompt = [prompt, textsBlock(ctx.texts)].filter(Boolean).join("\n");
  const firstImage = ctx.images[0];

  const instance: Record<string, unknown> = {
    prompt: fullPrompt,
    ...(firstImage && {
      image: {
        bytesBase64Encoded: firstImage.data.toString("base64"),
        mimeType: firstImage.mimeType,
      },
    }),
  };

  const start = async (withDuration: boolean): Promise<Response> =>
    fetch(`${BASE}/models/${VEO_MODEL}:predictLongRunning`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        instances: [instance],
        parameters: {
          aspectRatio: opts.aspectRatio ?? "16:9",
          ...(withDuration &&
            [4, 6, 8].includes(opts.durationSec ?? 0) && {
              durationSeconds: opts.durationSec,
            }),
        },
      }),
    });

  let res = await start(true);
  // بعض إصدارات النموذج ترفض معامل المدة — أعد المحاولة بدونه
  if (res.status === 400) res = await start(false);

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new Error(
      res.status === 429 && /limit:\s*0/.test(detail)
        ? "توليد الفيديو بـ Veo يتطلب تفعيل الفوترة في Google Cloud (غير متاح على الطبقة المجانية)"
        : `Veo ${res.status}: ${detail}`
    );
  }

  const op: VeoOperation = await res.json();
  if (!op.name) throw new Error("لم يُنشئ Veo عملية التوليد");

  // الاستعلام الدوري — الفيديو يستغرق نصف دقيقة إلى ثلاث دقائق
  let current: VeoOperation = op;
  for (let attempt = 0; attempt < 27 && !current.done; attempt++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const poll = await fetch(`${BASE}/${op.name}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!poll.ok) continue;
    current = await poll.json();
  }

  if (!current.done) throw new Error("انتهت مهلة توليد الفيديو — جرّب مدة أقصر");
  if (current.error?.message) throw new Error(`Veo: ${current.error.message}`);

  const gvr = current.response?.generateVideoResponse;
  const uri =
    gvr?.generatedSamples?.[0]?.video?.uri ??
    current.response?.generatedVideos?.[0]?.video?.uri;
  const inlineBytes = current.response?.generatedVideos?.[0]?.video?.videoBytes;

  if (inlineBytes) return { data: Buffer.from(inlineBytes, "base64"), mimeType: "video/mp4" };
  if (!uri) {
    throw new Error(
      gvr?.raiMediaFilteredCount
        ? "رفض مرشّح المحتوى في Veo هذا المشهد — جرّب وصفاً آخر"
        : "لم يتضمن ناتج Veo فيديو"
    );
  }

  const file = await fetch(uri, { headers: { "x-goog-api-key": apiKey } });
  if (!file.ok) throw new Error(`تعذّر تنزيل الفيديو (${file.status})`);
  return {
    data: Buffer.from(await file.arrayBuffer()),
    mimeType: file.headers.get("Content-Type")?.split(";")[0] || "video/mp4",
  };
}
