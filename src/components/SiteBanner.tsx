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
    ? { text: status.maintenanceMessage, tone: "border-primary/40 bg-rose text-primary-strong" }
    : status.banner
      ? { text: status.banner, tone: "border-border-soft bg-surface-raised text-body" }
      : status.demoMode
        ? { text: "الموقع يعمل حالياً بوضع العرض التجريبي — المخرجات تجريبية وليست بالمحركات الحقيقية", tone: "border-gold/40 bg-gold/10 text-amber-900" }
        : null;

  if (!notice) return null;

  return (
    <div className={`border-b px-4 py-2 text-center text-sm ${notice.tone}`} role="status">
      {notice.text}
    </div>
  );
}
