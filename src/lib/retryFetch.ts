/**
 * إعادة المحاولة على أعطال الازدحام العابرة — 503 لدى Google و529 لدى
 * Anthropic تعنيان «النموذج مزدحم الآن» لا عطلاً دائماً، والاستسلام من
 * أول ضربة يُسقط الميزة للوضع التجريبي بلا داعٍ. تراجع متدرج: 2ث ثم 4ث.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempts = 3
): Promise<Response> {
  let res: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    res = await fetch(url, init);
    if (res.status !== 503 && res.status !== 529) return res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  return res as Response;
}

/**
 * سلسلة نماذج Gemini النصية — الدرس نفسه من سلسلة ليرا: الازدحام
 * المستمر (503 رغم إعادة المحاولة) أو أي فشل نموذج ينتقل للمرشح
 * التالي بدل إسقاط الميزة للوضع التجريبي. GEMINI_MODEL يقبل قائمة
 * بفواصل، وتُقرأ عند كل نداء (لا تجميد عند الإقلاع).
 */
export function geminiTextModels(): string[] {
  return (process.env.GEMINI_MODEL ?? "gemini-3.6-flash,gemini-3.8-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/** نداء generateContent عبر السلسلة — يعيد أول استجابة ناجحة أو آخر فاشلة */
export async function geminiGenerate(apiKey: string, body: unknown): Promise<Response> {
  let last: Response | null = null;
  for (const model of geminiTextModels()) {
    const res = await fetchWithRetry(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
      }
    );
    if (res.ok) return res;
    console.error(`Gemini text model ${model} failed: ${res.status}`);
    last = res;
  }
  return last as Response;
}

/**
 * سلسلة كتّاب السيناريو الصوتي (الدراما والبودكاست ومؤثرات المشهد):
 * الأحدث أولاً والمجرَّب رجوعاً — بخلاف سلسلة المساعد التي تبدأ بالمجرَّب.
 * GEMINI_SCRIPT_MODEL قائمة بفواصل تثبّت النموذج أو تعكس الترتيب بلا نشر.
 */
export function geminiScriptModels(): string[] {
  return (process.env.GEMINI_SCRIPT_MODEL ?? "gemini-3.8-flash,gemini-3.6-flash")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * توليد مهيكل عبر سلسلة: يُجرَّب كل نموذج حتى يُنتج ما يقبله `read`
 * (فحص سبب التوقف وتحليل JSON والتطهير). فشل HTTP أو ناتج لا يُقرأ ينقل
 * للمرشح التالي — فعقد جديد لم يُختبر على مساراتنا لا يُسقط الميزة —
 * وفشل الجميع يرمي خطأ آخر نموذج كما هو ليصل سببه للشاشة.
 */
export async function geminiStructured<T>(
  apiKey: string,
  body: unknown,
  read: (json: unknown) => T,
  models: string[] = geminiScriptModels()
): Promise<T> {
  let lastError: unknown = new Error("لا نموذج نصي مضبوط");
  for (const model of models) {
    try {
      const res = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
      }
      return read(await res.json());
    } catch (e) {
      console.error(`Gemini script model ${model} failed:`, e instanceof Error ? e.message : e);
      lastError = e;
    }
  }
  throw lastError;
}
