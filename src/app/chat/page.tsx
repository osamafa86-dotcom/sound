"use client";

/**
 * غرفة الدردشة العامة — بلا حسابات: اسم مستعار محفوظ محلياً، ورسائل حية
 * عبر استطلاع دوري كل ٣ ثوانٍ. كل الأزرار مفعّلة: دخول، إرسال، إيموجي،
 * تغيير الاسم، ونسخ رسالة. الرسائل الخاصة بي تظهر على اليمين.
 */

import { useEffect, useRef, useState } from "react";

type ChatMessage = { id: number; name: string; text: string; at: number };

const NAME_KEY = "lahn-chat-name";
const EMOJIS = ["😀", "😂", "❤️", "🔥", "👍", "🙏", "🎉", "😍", "😎", "🥳", "😢", "🤔", "👏", "💯", "🌹", "🎵"];

export default function ChatPage() {
  const [name, setName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [joined, setJoined] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [online, setOnline] = useState(0);
  const [error, setError] = useState("");
  const lastIdRef = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // استعادة الاسم المحفوظ
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = localStorage.getItem(NAME_KEY);
        if (saved) {
          setName(saved);
          setJoined(true);
        }
      } catch {
        /* تخزين معطل */
      }
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // الاستطلاع الدوري بعد الدخول
  useEffect(() => {
    if (!joined) return;
    let alive = true;
    async function poll() {
      try {
        const d = await fetch(`/api/chat?since=${lastIdRef.current}`, { cache: "no-store" }).then((r) => r.json());
        if (!alive) return;
        if (Array.isArray(d.messages) && d.messages.length) {
          setMessages((prev) => {
            const ids = new Set(prev.map((m) => m.id));
            const fresh = d.messages.filter((m: ChatMessage) => !ids.has(m.id));
            return [...prev, ...fresh].slice(-200);
          });
          lastIdRef.current = d.lastId ?? lastIdRef.current;
        } else if (typeof d.lastId === "number" && lastIdRef.current === 0) {
          lastIdRef.current = d.lastId;
        }
        if (typeof d.online === "number") setOnline(d.online);
      } catch {
        /* الشبكة — نعيد المحاولة */
      }
      if (alive) pollRef.current = setTimeout(poll, 3000);
    }
    poll();
    return () => {
      alive = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [joined]);

  // نبضة الحضور — تُبقي الزائر «متصلاً» ويظهر عدد المتصلين للجميع
  useEffect(() => {
    if (!joined) return;
    let alive = true;
    const ping = () => {
      fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ping", name }),
      })
        .then((r) => r.json())
        .then((d) => alive && typeof d.online === "number" && setOnline(d.online))
        .catch(() => {});
    };
    ping();
    const iv = setInterval(ping, 25_000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [joined, name]);

  // التمرير للأسفل عند وصول رسائل
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function join() {
    const clean = draftName.trim().slice(0, 24);
    if (clean.length < 2) {
      setError("اكتب اسماً من حرفين على الأقل");
      return;
    }
    setName(clean);
    try {
      localStorage.setItem(NAME_KEY, clean);
    } catch {
      /* تجاهل */
    }
    setJoined(true);
    setError("");
  }

  function changeName() {
    setJoined(false);
    setDraftName(name);
    setMessages([]);
    lastIdRef.current = 0;
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError("");
    try {
      const d = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text: body }),
      }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setText("");
      setShowEmoji(false);
      if (d.message) {
        setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message].slice(-200)));
        lastIdRef.current = Math.max(lastIdRef.current, d.message.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذّر الإرسال");
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  async function deleteMsg(id: number) {
    // إزالة فورية متفائلة، ثم الخادم
    setMessages((prev) => prev.filter((m) => m.id !== id));
    try {
      const d = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id, name }),
      }).then((r) => r.json());
      if (d.error) setError(d.error);
    } catch {
      /* الاستطلاع سيعيد الرسالة إن فشل الحذف */
    }
  }

  async function copyMsg(t: string) {
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      /* المتصفح منع النسخ */
    }
  }

  function fmtTime(ms: number) {
    try {
      return new Date(ms).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  // ===== شاشة الدخول =====
  if (!joined) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-4">
        <p className="text-5xl">💬</p>
        <h1 className="mt-3 text-3xl font-extrabold">
          غرفة <span className="text-gradient">الدردشة</span>
        </h1>
        <p className="mt-2 text-center text-muted">ادخل باسمك وتحدّث مع كل زوار لحّن مباشرة.</p>
        <div className="mt-6 w-full rounded-3xl border border-border-soft bg-surface-card p-6">
          <label className="text-sm font-bold text-muted">اسمك في الغرفة</label>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && join()}
            maxLength={24}
            autoFocus
            placeholder="مثال: أبو محمد"
            className="mt-2 w-full rounded-xl border border-border-soft bg-surface px-4 py-3 text-center outline-none transition-colors focus:border-primary"
          />
          {error && <p className="mt-2 text-center text-sm font-bold text-primary-strong">{error}</p>}
          <button
            onClick={join}
            className="mt-4 w-full rounded-xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-primary-strong"
          >
            ادخل الغرفة ←
          </button>
        </div>
      </div>
    );
  }

  // ===== الغرفة =====
  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-2 py-3 lg:h-screen lg:py-4">
      {/* الترويسة */}
      <div className="flex items-center justify-between rounded-2xl border border-border-soft bg-surface-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💬</span>
          <div>
            <h1 className="font-extrabold">غرفة الدردشة</h1>
            <p className="text-xs text-muted">
              أنت: <span className="font-bold text-primary">{name}</span>
              {online > 0 && (
                <span className="ms-2 inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  {online} متصل الآن
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={changeName}
          className="rounded-xl border border-border-soft px-3 py-1.5 text-xs font-bold text-muted transition-colors hover:border-primary hover:text-primary"
        >
          ✏️ غيّر اسمك
        </button>
      </div>

      {/* الرسائل */}
      <div ref={listRef} className="my-3 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-border-soft bg-surface p-4">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">لا رسائل بعد — كن أول من يبدأ الحديث 👋</p>
        ) : (
          messages.map((m) => {
            const mine = m.name === name;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div
                  className={`group max-w-[80%] rounded-2xl px-4 py-2 ${
                    mine ? "bg-primary text-white" : "bg-surface-card border border-border-soft"
                  }`}
                >
                  {!mine && <p className="mb-0.5 text-xs font-bold text-accent">{m.name}</p>}
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.text}</p>
                  <div className="mt-1 flex items-center justify-end gap-2">
                    <button
                      onClick={() => copyMsg(m.text)}
                      title="نسخ"
                      className={`text-[10px] opacity-0 transition-opacity group-hover:opacity-70 ${mine ? "text-white" : "text-muted"}`}
                    >
                      📋
                    </button>
                    {mine && (
                      <button
                        onClick={() => deleteMsg(m.id)}
                        title="حذف رسالتي"
                        className="text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-70"
                      >
                        🗑️
                      </button>
                    )}
                    <span className={`text-[10px] ${mine ? "text-white/70" : "text-muted"}`}>{fmtTime(m.at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* لوحة الإيموجي */}
      {showEmoji && (
        <div className="mb-2 flex flex-wrap gap-1 rounded-2xl border border-border-soft bg-surface-card p-3">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setText((t) => t + e)}
              className="rounded-lg p-1.5 text-xl transition-colors hover:bg-surface"
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mb-2 text-center text-sm font-bold text-primary-strong">{error}</p>}

      {/* شريط الإدخال */}
      <div className="flex items-end gap-2 rounded-2xl border border-border-soft bg-surface-card p-2">
        <button
          onClick={() => setShowEmoji((s) => !s)}
          title="رموز تعبيرية"
          className="rounded-xl px-3 py-2.5 text-xl transition-colors hover:bg-surface"
        >
          😊
        </button>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          maxLength={500}
          placeholder="اكتب رسالتك..."
          className="max-h-32 flex-1 resize-none bg-transparent px-2 py-2.5 outline-none"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="rounded-xl bg-primary px-5 py-2.5 font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
        >
          {sending ? "..." : "إرسال ➤"}
        </button>
      </div>
    </div>
  );
}
