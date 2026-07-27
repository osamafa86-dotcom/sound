"use client";

/**
 * مُرسل الإشارات من المتصفح — نداء «أطلق وانسَ»:
 * لا ينتظر ولا يفشل بصوت؛ keepalive يضمن الوصول حتى أثناء مغادرة الصفحة.
 */

export type ClientSignal = {
  kind:
    | "played_to_end"
    | "replayed"
    | "downloaded"
    | "saved"
    | "shared"
    | "regenerated"
    | "section_regen"
    | "version_chosen"
    | "version_rejected";
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
