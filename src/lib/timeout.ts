/**
 * مهلة قصوى لعملية شبكية — بلا هذه المهلة يبقى الطلب المعلّق (لا ينجح
 * ولا يفشل) يدور إلى الأبد، فيرى المستخدم زراً «جارٍ...» بلا أي رسالة
 * ويظن أن الموقع لا يستجيب. أي شيء لا يجيب خلال المهلة يُعتبر فشلاً
 * صريحاً برسالة مفهومة.
 */

export const NETWORK_TIMEOUT_MS = 15_000;

/** رسالة موحّدة لتعذّر الوصول — قابلة للتمييز في معالجات الأخطاء */
export const UNREACHABLE =
  "تعذّر الوصول إلى خدمة الحسابات — تحقّق من اتصالك بالإنترنت أو من مانع إعلانات/إضافة تحجب الطلب، ثم أعد المحاولة.";

export function withTimeout<T>(promise: Promise<T>, ms = NETWORK_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(UNREACHABLE)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/** هل هذا خطأ شبكة؟ رسائل المتصفحات بالإنجليزية وتختلف بينها */
export function isNetworkError(message: string): boolean {
  return (
    message === UNREACHABLE ||
    /failed to fetch|networkerror|load failed|network request failed|err_/i.test(message)
  );
}
