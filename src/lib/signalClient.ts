"use client";

import type { SignalKind } from "./signals";

/**
 * مُرسل الإشارات من المتصفح — نداء «أطلق وانسَ»:
 * لا ينتظر ولا يفشل بصوت؛ keepalive يضمن الوصول حتى أثناء مغادرة الصفحة.
 * (استيراد النوع وحده — شيفرة الخادم لا تدخل حزمة المتصفح)
 */

export type ClientSignal = {
  kind: SignalKind;
  voiceId?: string;
  maqamId?: string;
  settings?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export function emitSignal(signal: ClientSignal): void {
  try {
    fetch("/api/signals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(signal),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* الإشارات ثانوية — لا تكسر التجربة أبداً */
  }
}
