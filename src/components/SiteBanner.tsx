"use client";

import { useEffect, useState } from "react";

type Status = { maintenance: boolean; maintenanceMessage: string; banner: string; demoMode: boolean };

/**
 * لافتة أعلى الموقع يتحكم بها مالك النظام من لوحة التحكم:
 * إعلان عام، أو تنبيه صيانة، أو تنويه بأن الموقع في وضع تجريبي.
 */
export default function SiteBanner() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  if (!status) return null;

  const notice = status.maintenance
    ? { text: status.maintenanceMessage, tone: "border-red-500/40 bg-red-500/10 text-red-200" }
    : status.banner
      ? { text: status.banner, tone: "border-primary/40 bg-primary/10 text-body" }
      : status.demoMode
        ? { text: "الموقع يعمل حالياً بوضع العرض التجريبي — المخرجات تجريبية وليست بالمحركات الحقيقية", tone: "border-amber-500/40 bg-amber-500/10 text-amber-200" }
        : null;

  if (!notice) return null;

  return (
    <div className={`border-b px-4 py-2 text-center text-sm ${notice.tone}`} role="status">
      {notice.text}
    </div>
  );
}
