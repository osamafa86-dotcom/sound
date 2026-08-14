"use client";

/**
 * التسخين المسبق للاستوديوهات — بعد استقرار الصفحة الحالية بلحظات،
 * تُجلب حزم بقية الصفحات بهدوء في الخلفية (RSC + JS) فيصبح التنقل
 * إليها شبه فوري بدل شاشة الانتظار، حتى في تطبيق الجوال المثبت.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";

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

export default function RouteWarmup() {
  const router = useRouter();
  useEffect(() => {
    // ننتظر ثانيتين كي لا نزاحم تحميل الصفحة المفتوحة نفسها
    const t = setTimeout(() => {
      for (const r of WARM_ROUTES) {
        try {
          router.prefetch(r);
        } catch {
          /* المتصفح قد يرفض على اتصالات موفّرة للبيانات — لا بأس */
        }
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [router]);
  return null;
}
