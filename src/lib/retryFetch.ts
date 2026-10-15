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
