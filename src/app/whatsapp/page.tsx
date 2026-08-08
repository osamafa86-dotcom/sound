"use client";

import { useEffect, useRef, useState } from "react";

/**
 * صندوق واتساب — محادثات زبائنك الحقيقيين ورَدّك عليهم.
 *
 * الطرف الآخر لا يثبّت شيئاً: يكتب لك من واتساب الذي في هاتفه، وردّك يصله
 * هناك. لذلك هذه الصفحة صندوق وارد لا تطبيق مراسلة.
 */

type Conversation = {
  contact: string;
  name: string | null;
  lastText: string | null;
  lastAt: string;
  count: number;
};

type Message = {
  waId: string;
  contact: string;
  direction: "in" | "out";
  type: string;
  text: string | null;
  createdAt: string;
};

const clock = (d: string) =>
  new Date(d).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
const day = (d: string) =>
  new Date(d).toLocaleDateString("ar-EG", { day: "numeric", month: "short" });

/** الرد الحرّ مسموح ٢٤ ساعة من آخر رسالة من الزبون — قيد Meta لا قيدنا */
function windowLeft(lastAt: string): { open: boolean; label: string } {
  const hours = (Date.now() - new Date(lastAt).getTime()) / 3600000;
  if (hours >= 24) return { open: false, label: "أُغلقت نافذة الرد الحرّ (٢٤ ساعة)" };
  const left = Math.floor(24 - hours);
  return { open: true, label: left >= 1 ? `تبقّى ${left} ساعة للرد الحرّ` : "أقل من ساعة للرد الحرّ" };
}

export default function WhatsAppInbox() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load(contact: string | null) {
    try {
      const url = contact ? `/api/whatsapp/messages?contact=${encodeURIComponent(contact)}` : "/api/whatsapp/messages";
      const res = await fetch(url);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر التحميل");
      setConfigured(!!data.configured);
      setConversations(data.conversations ?? []);
      setMessages(data.messages ?? []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
      setConfigured(false);
    }
  }

  useEffect(() => {
    let stop = false;
    async function tick() {
      if (!stop) await load(active);
    }
    tick();
    // الرسائل تصل عبر الـ webhook لا إلى المتصفح — فنسأل الخادم دورياً
    const timer = setInterval(tick, 10000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [active]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  async function send() {
    if (!draft.trim() || !active) return;
    setSending(true);
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: active, text: draft.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "تعذّر الإرسال");
      setDraft("");
      await load(active);
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطأ غير متوقع");
    } finally {
      setSending(false);
    }
  }

  const current = conversations.find((c) => c.contact === active);
  const gate = current ? windowLeft(current.lastAt) : null;

  if (configured === false && !conversations.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold">💬 صندوق واتساب</h1>
        <div className="mt-8 rounded-2xl border border-border-soft bg-surface-card p-8">
          <p className="leading-relaxed">
            {error || "التكامل غير مفعّل على هذا الخادم."}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            يحتاج ثلاثة متغيرات: <code>WHATSAPP_PHONE_NUMBER_ID</code> و
            <code>WHATSAPP_TOKEN</code> و<code>WHATSAPP_VERIFY_TOKEN</code>.
            الخطوات كاملة في <code>docs/whatsapp-setup.md</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold">
        💬 صندوق <span className="text-gradient">واتساب</span>
      </h1>
      <p className="mt-1 text-sm text-muted">
        رسائل زبائنك الحقيقية — يكتبون من واتساب في هواتفهم، وردّك يصلهم هناك.
      </p>

      {error && (
        <p className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-[300px_1fr]">
        {/* المحادثات */}
        <aside className="rounded-2xl border border-border-soft bg-surface-card">
          {conversations.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              لا رسائل بعد. أرسل رسالة من هاتفك إلى رقم الأعمال فتظهر هنا خلال ثوانٍ.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.contact}
                  onClick={() => setActive(c.contact)}
                  className={`flex w-full flex-col gap-1 border-b border-border-soft p-4 text-start transition-colors ${
                    active === c.contact ? "bg-surface" : "hover:bg-surface"
                  }`}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-semibold">{c.name || c.contact}</span>
                    <span className="shrink-0 text-xs text-muted">{day(c.lastAt)}</span>
                  </span>
                  <span className="truncate text-xs text-muted" dir="ltr">
                    {c.contact}
                  </span>
                  <span className="truncate text-xs text-muted">{c.lastText || "—"}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* المحادثة */}
        <section className="flex min-h-[60vh] flex-col rounded-2xl border border-border-soft bg-surface-card">
          {!active ? (
            <p className="m-auto text-sm text-muted">اختر محادثة من القائمة</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-border-soft p-4">
                <div>
                  <p className="font-bold">{current?.name || active}</p>
                  <p className="text-xs text-muted" dir="ltr">{active}</p>
                </div>
                {gate && (
                  <span className={`rounded-full border px-3 py-1 text-xs ${
                    gate.open ? "border-border-soft text-muted" : "border-red-500/40 text-red-300"
                  }`}>
                    {gate.label}
                  </span>
                )}
              </div>

              <div ref={boxRef} className="flex-1 overflow-y-auto p-4">
                <div className="flex flex-col gap-2">
                  {messages.map((m) => (
                    <div
                      key={m.waId}
                      className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                        m.direction === "out"
                          ? "self-end bg-primary/15 border border-primary/30"
                          : "self-start bg-surface border border-border-soft"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.text || `(${m.type})`}</p>
                      <p className="mt-1 text-[11px] text-muted">{clock(m.createdAt)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-end gap-2 border-t border-border-soft p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={gate?.open ? "اكتب ردّك..." : "نافذة الرد الحرّ مغلقة — يلزم قالب معتمَد"}
                  className="max-h-32 flex-1 resize-none rounded-xl border border-border-soft bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <button
                  onClick={send}
                  disabled={sending || !draft.trim()}
                  className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
                >
                  {sending ? "..." : "إرسال"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
