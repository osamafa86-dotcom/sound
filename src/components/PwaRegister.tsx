"use client";

import { useEffect } from "react";

/** يسجّل الـ Service Worker في الإنتاج فقط — يفعّل التثبيت والعمل دون اتصال */
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* فشل التسجيل لا يعطّل الموقع */
    });
  }, []);

  return null;
}
