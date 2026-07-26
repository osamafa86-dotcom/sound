"use client";

import { useEffect, useState } from "react";
import type { AdminUser } from "@/lib/admin/types";
import { Badge, Card, NotConfigured, Table, fmtDate, fmtNum } from "./ui";

type UsersResponse =
  | { configured: true; users: AdminUser[]; page: number; perPage: number; hasMore: boolean }
  | { configured: false };

/** إدارة المستخدمين: النشاط والرصيد وتعديله */
export default function UsersTab() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users?page=${page}&perPage=50`)
      .then((r) => r.json())
      .then((d) => !cancelled && setData(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page]);

  async function saveCredits(user: AdminUser) {
    const credits = Number(draft);
    if (!Number.isFinite(credits) || credits < 0) {
      setMessage("قيمة الرصيد غير صحيحة");
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, credits }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.error ?? "تعذّر التحديث");
      return;
    }
    setMessage(`تم تحديث رصيد ${user.email ?? user.id} إلى ${credits}`);
    setEditing(null);
    setData((prev) =>
      prev?.configured
        ? { ...prev, users: prev.users.map((u) => (u.id === user.id ? { ...u, credits } : u)) }
        : prev
    );
  }

  if (loading && !data) return <p className="text-sm text-muted">جارٍ التحميل…</p>;
  if (!data?.configured) return <NotConfigured what="سجل المستخدمين" />;

  const term = query.trim().toLowerCase();
  const users = term
    ? data.users.filter((u) => (u.email ?? "").toLowerCase().includes(term) || u.id.includes(term))
    : data.users;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث بالبريد أو المعرّف…"
          className="w-full max-w-xs rounded-xl border border-border-soft bg-surface-raised px-4 py-2 text-sm outline-none focus:border-primary sm:w-auto"
        />
        <span className="text-xs text-muted">
          {fmtNum(users.length)} من {fmtNum(data.users.length)} في هذه الصفحة
        </span>
      </div>

      {message && <p className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-sm">{message}</p>}

      <Card>
        <Table head={["المستخدم", "التسجيل", "آخر دخول", "أعمال", "استهلاك ٣٠ يوماً", "الرصيد", ""]}>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="truncate">{u.email ?? "—"}</span>
                  {u.isOwner && <Badge tone="info">مالك</Badge>}
                  {!u.confirmed && <Badge tone="warn">غير مؤكّد</Badge>}
                </div>
                <span className="font-mono text-[10px] text-muted">{u.id.slice(0, 8)}</span>
              </td>
              <td className="px-3 py-2 text-xs text-muted">{fmtDate(u.createdAt)}</td>
              <td className="px-3 py-2 text-xs text-muted">{fmtDate(u.lastSignInAt)}</td>
              <td className="px-3 py-2 tabular-nums">{fmtNum(u.generations)}</td>
              <td className="px-3 py-2 tabular-nums">{fmtNum(u.usage30d)}</td>
              <td className="px-3 py-2 tabular-nums">
                {editing === u.id ? (
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveCredits(u)}
                    className="w-24 rounded-lg border border-primary bg-surface-raised px-2 py-1 text-sm outline-none"
                  />
                ) : (
                  (u.credits ?? "—")
                )}
              </td>
              <td className="px-3 py-2">
                {editing === u.id ? (
                  <div className="flex gap-1">
                    <button onClick={() => saveCredits(u)} className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white">
                      حفظ
                    </button>
                    <button onClick={() => setEditing(null)} className="rounded-lg border border-border-soft px-3 py-1 text-xs text-muted">
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditing(u.id);
                      setDraft(String(u.credits ?? 0));
                      setMessage("");
                    }}
                    className="rounded-lg border border-border-soft px-3 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-body"
                  >
                    عدّل الرصيد
                  </button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="rounded-xl border border-border-soft px-4 py-2 text-sm disabled:opacity-40"
        >
          السابق
        </button>
        <span className="text-sm text-muted">صفحة {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!data.hasMore}
          className="rounded-xl border border-border-soft px-4 py-2 text-sm disabled:opacity-40"
        >
          التالي
        </button>
      </div>
    </div>
  );
}
