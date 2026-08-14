"use client";

import { useEffect, useState } from "react";
import { Badge, Card, fmtDate } from "./ui";

type Ticket = {
  id: string;
  email: string;
  topic: string;
  message: string;
  status: "open" | "closed";
  reply: string | null;
  created_at: string;
  user_id: string | null;
};

/** تذاكر الدعم — قراءة، رد يُحفظ في سجل التذكرة، إغلاق وإعادة فتح */
export default function SupportTab() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [loading, setLoading] = useState(true);
  const [replyFor, setReplyFor] = useState("");
  const [replyText, setReplyText] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/support")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setTickets(d.tickets ?? []);
        setNeedsMigration(!!d.needsMigration);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  async function update(id: string, status: "open" | "closed", reply?: string) {
    await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status, ...(reply !== undefined && { reply }) }),
    }).catch(() => {});
    setReplyFor("");
    setReplyText("");
    setReloadToken((t) => t + 1);
  }

  if (loading) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل...</p>;

  if (needsMigration) {
    return (
      <Card title="تذاكر الدعم">
        <p className="text-sm leading-relaxed text-muted">
          جدول التذاكر غير موجود بعد — شغّل <code dir="ltr">schema.sql</code> المحدّث في Supabase
          SQL Editor ثم أعد فتح هذا التبويب.
        </p>
      </Card>
    );
  }

  const open = tickets.filter((t) => t.status === "open");
  const closed = tickets.filter((t) => t.status === "closed");

  return (
    <div className="flex flex-col gap-5">
      <Card title={`التذاكر المفتوحة (${open.length})`}>
        {open.length === 0 ? (
          <p className="text-sm text-muted">لا تذاكر مفتوحة — صندوقك نظيف 🎉</p>
        ) : (
          <div className="flex flex-col gap-3">
            {open.map((t) => (
              <div key={t.id} className="rounded-xl border border-border-soft bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge tone="info">{t.topic}</Badge>
                    <span dir="ltr" className="font-semibold">{t.email}</span>
                    {t.user_id && <Badge tone="good">مسجل</Badge>}
                  </div>
                  <span className="text-xs text-muted">{fmtDate(t.created_at)}</span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{t.message}</p>

                {replyFor === t.id ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      maxLength={4000}
                      placeholder="ردك... يُحفظ في سجل التذكرة (أرسله للمستخدم عبر بريده)"
                      className="w-full resize-y rounded-lg border border-border-soft bg-surface-card p-2.5 text-sm outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => update(t.id, "closed", replyText)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        ✓ احفظ الرد وأغلق
                      </button>
                      <button
                        onClick={() => setReplyFor("")}
                        className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <a
                      href={`mailto:${t.email}?subject=${encodeURIComponent(`رد لحّن: ${t.topic}`)}`}
                      className="rounded-lg border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      📧 رد بالبريد
                    </a>
                    <button
                      onClick={() => {
                        setReplyFor(t.id);
                        setReplyText(t.reply ?? "");
                      }}
                      className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted hover:text-body"
                    >
                      💬 رد وأغلق
                    </button>
                    <button
                      onClick={() => update(t.id, "closed")}
                      className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted hover:text-body"
                    >
                      إغلاق بلا رد
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {closed.length > 0 && (
        <Card title={`المغلقة (${closed.length})`}>
          <div className="flex flex-col gap-2">
            {closed.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2 text-xs"
              >
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted">{t.topic} · </span>
                  <span dir="ltr">{t.email}</span>
                  <span className="text-muted"> — {t.message.slice(0, 60)}</span>
                </span>
                <button
                  onClick={() => update(t.id, "open")}
                  className="shrink-0 text-muted underline-offset-2 hover:underline"
                >
                  إعادة فتح
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
