"use client";

/**
 * شاشة الانتقال الاحتفالية — بطلب صاحب الموقع: كل تنقل بين الصفحات
 * يعرض شعار لحّن النابض ٥ ثوانٍ مرة واحدة لكل جلسة تصفح، ثم تنقّل حر.
 * (لا تظهر عند الفتح الأول للموقع — للتنقلات الداخلية فقط.)
 */
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SPLASH_MS = 5_000;

export default function TransitionSplash() {
  const pathname = usePathname();
  const firstMount = useRef(true);
  const [visible, setVisible] = useState(false);
  const [fill, setFill] = useState(false);

  useEffect(() => {
    if (firstMount.current) {
      firstMount.current = false;
      return;
    }
    // للجمهور: الشاشة الاحتفالية مرة واحدة لكل جلسة — تكرارها مع كل تنقل
    // يهرّب الزوار الجدد. (امسح sessionStorage لمعاينتها مجدداً)
    try {
      if (sessionStorage.getItem("lahn-splash-shown")) return;
      sessionStorage.setItem("lahn-splash-shown", "1");
    } catch {
      /* تخزين معطل — نعرضها عادي */
    }
    let t: ReturnType<typeof setTimeout> | undefined;
    let raf2 = 0;
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      setFill(false);
      raf2 = requestAnimationFrame(() => setFill(true));
      t = setTimeout(() => setVisible(false), SPLASH_MS);
    });
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(raf2);
      if (t) clearTimeout(t);
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-surface">
      {/* الشعار النابض */}
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 items-center justify-center gap-[5px] rounded-2xl bg-primary shadow-lg shadow-primary/30">
          {[0.3, 0.55, 0.38, 0.6].map((f, i) => (
            <span
              key={i}
              className="w-[5px] animate-pulse rounded-full bg-white"
              style={{ height: 64 * f, animationDelay: `${i * 150}ms` }}
            />
          ))}
        </span>
        <span className="font-heading text-4xl font-extrabold">
          لحّن<span className="text-primary">.</span>
        </span>
      </div>
      {/* شريط التقدم — يمتلئ خلال العشر ثوانٍ بالضبط */}
      <div className="h-1.5 w-64 overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: fill ? "100%" : "0%",
            transition: `width ${SPLASH_MS}ms linear`,
          }}
        />
      </div>
      <p className="text-sm font-semibold text-muted">الرجاء الانتظار...</p>
    </div>
  );
}
