/* Service Worker لمنصة «لحّن»
 * - صفحات التنقل: الشبكة أولاً مع سقوط للنسخة المخبأة ثم صفحة «دون اتصال»
 * - أصول Next الثابتة والخطوط والأيقونات: الكاش أولاً (محتواها مبصوم بالهاش)
 * - لا يلمس أبداً: طلبات API، الصوتيات، أي طلب غير GET
 */
const VERSION = "maqam-pwa-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // لا نتدخل في الـ API ولا الملفات الصوتية ولا طلبات المدى الجزئي (بث الصوت)
  if (url.pathname.startsWith("/api/")) return;
  if (/\.(?:mp3|wav|ogg|m4a|webm)$/i.test(url.pathname)) return;
  if (request.headers.has("range")) return;

  // التنقل بين الصفحات: شبكة أولاً ثم الكاش ثم صفحة «دون اتصال»
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // الأصول الثابتة المبصومة بالهاش: كاش أولاً
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|gif|webp|svg|ico)$/i.test(url.pathname);
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});
