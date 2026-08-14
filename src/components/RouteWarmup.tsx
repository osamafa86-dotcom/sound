"use client";

/**
 * التسخين المسبق للاستوديوهات — بعد ١٠ ثوانٍ من الهدوء عقب كل تنقل،
 * تُجلب حزم بقية الصفحات في الخلفية (RSC + JS) فيصبح التنقل التالي
 * شبه فوري. المهلة الطويلة تضمن ألا يزاحم التسخينُ الصفحةَ المفتوحة
 * ولا يستهلك بياناتها وهي ما زالت تحمّل. التنقل يعيد ضبط المؤقت.
 */
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const WARM_ROUTES = [
  "/tts",
  "/songs",
  "/anime",
  "/draw",
  "/drama",
  "/podcast",
  "/voice",
  "/studio",
  "/voices",
  "/gallery",
  "/library",
];

const CALM_DELAY_MS = 10_000;

export default function RouteWarmup() {
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (pathname.startsWith("/gate")) return; // غير مصادَق بعد — أي جلب سيُرفض
    const t = setTimeout(() => {
      for (const r of WARM_ROUTES) {
        if (r === pathname) continue; // الصفحة الحالية محمّلة أصلاً
        try {
          router.prefetch(r);
        } catch {
          /* المتصفح قد يرفض على اتصالات موفّرة للبيانات — لا بأس */
        }
      }
    }, CALM_DELAY_MS);
    return () => clearTimeout(t);
  }, [router, pathname]);
  return null;
}
