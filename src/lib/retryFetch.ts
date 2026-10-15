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
