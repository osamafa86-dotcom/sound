"use client";

/**
 * صفحة الحماية — إدارة ذاتية كاملة بلا نشر:
 * إضافة كلمة سر / تغييرها / إزالتها. الحالة تُقرأ حية من الخادم.
 */

import { useEffect, useState } from "react";

export default function SecurityPage() {
  const [protectedSite, setProtectedSite] = useState<boolean | null>(null);
  const [ownerKeyConfigured, setOwnerKeyConfigured] = useState<boolean | null>(null);
  const [ownerKey, setOwnerKey] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [next2, setNext2] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function refresh() {
    try {
      const d = await fetch("/api/security").then((r) => r.json());
      setProtectedSite(!!d.protected);
      setOwnerKeyConfigured(!!d.ownerKeyConfigured);
    } catch {
      setMsg({ ok: false, text: "تعذّر قراءة حالة الحماية" });
    }
  }
  useEffect(() => {
    // تأجيل لما بعد الالتحام — يرضي قاعدة عدم setState المتزامن في المؤثرات
    const t = setTimeout(refresh, 0);
    return () => clearTimeout(t);
  }, []);

  async function call(payload: Record<string, unknown>, busyKey: string, okText: string) {
    setBusy(busyKey);
    setMsg(null);
    try {
      const d = await fetch("/api/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, ownerKey }),
      }).then((r) => r.json());
      if (d.error) throw new Error(d.error);
      setMsg({ ok: true, text: okText });
      setCurrent("");
      setNext("");
      setNext2("");
      await refresh();
      return true;
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "حدث خطأ" });
      return false;
    } finally {
      setBusy("");
    }
  }

  async function setPassword() {
    if (next.length < 6) return setMsg({ ok: false, text: "كلمة السر ٦ أحرف على الأقل" });
    if (next !== next2) return setMsg({ ok: false, text: "التأكيد لا يطابق كلمة السر" });
    await call(
      { action: "set_password", current, next },
      "set",
      protectedSite ? "✓ غُيّرت كلمة السر — الجلسات القديمة أُبطلت" : "✓ فُعّلت الحماية بكلمة السر"
    );
  }

  async function removePassword() {
    if (!confirm("سيصبح الموقع مفتوحاً للجميع بلا كلمة سر. متأكد؟")) return;
    await call({ action: "remove_password", current }, "remove", "✓ أُزيلت كلمة السر — الموقع مفتوح الآن");
  }

  const inputCls =
    "w-full rounded-xl border border-border-soft bg-surface px-4 py-2.5 outline-none transition-colors focus:border-primary";

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center">
        <p className="text-4xl">🛡️</p>
        <h1 className="mt-2 text-3xl font-extrabold">
          حماية <span className="text-gradient">الموقع</span>
        </h1>
        <p className="mt-2 text-muted">
          {protectedSite === null
            ? "جارٍ قراءة الحالة..."
            : protectedSite
              ? "🔒 الموقع محمي — كلمة السر مطلوبة للدخول"
              : "🔓 الموقع مفتوح حالياً — لا كلمة سر"}
        </p>
      </div>

      {ownerKeyConfigured === false && (
        <p className="mt-6 rounded-xl border border-primary/40 bg-rose px-4 py-3 text-center text-sm font-bold text-primary-strong">
          🔐 إدارة الحماية مقفلة. اضبط متغير <code>SITE_OWNER_KEY</code> في إعدادات Vercel
          (Settings → Environment Variables) بقيمة سرية تعرفها أنت وحدك، ثم أعد النشر —
          فلا يستطيع أي زائر قفل موقعك أو تغيير كلمته.
        </p>
      )}

      {ownerKeyConfigured && (
        <div className="mt-6 rounded-3xl border border-gold/40 bg-surface-card p-6">
          <h2 className="font-extrabold">🗝️ مفتاح المالك</h2>
          <p className="mt-1 text-sm text-muted">
            أدخل مفتاحك السري (SITE_OWNER_KEY) للسماح بأي تعديل أدناه — الزوار لا يعرفونه.
          </p>
          <input
            type="password"
            placeholder="مفتاح المالك السري"
            value={ownerKey}
            onChange={(e) => setOwnerKey(e.target.value)}
            className={`${inputCls} mt-3`}
          />
        </div>
      )}

      {msg && (
        <p
          className={`mt-6 rounded-xl px-4 py-3 text-center text-sm font-bold ${
            msg.ok ? "bg-rose text-primary" : "border border-primary/40 bg-rose text-primary-strong"
          }`}
        >
          {msg.text}
        </p>
      )}

      {ownerKeyConfigured && (<>
      {/* كلمة السر */}
      <div className="mt-8 rounded-3xl border border-border-soft bg-surface-card p-6">
        <h2 className="font-extrabold">🔑 {protectedSite ? "تغيير كلمة السر" : "إضافة كلمة سر"}</h2>
        <div className="mt-4 flex flex-col gap-3">
          {protectedSite && (
            <input
              type="password"
              placeholder="كلمة السر الحالية"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputCls}
            />
          )}
          <input
            type="password"
            placeholder={protectedSite ? "كلمة السر الجديدة (٦+ أحرف)" : "كلمة السر (٦+ أحرف)"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className={inputCls}
          />
          <input
            type="password"
            placeholder="تأكيد كلمة السر"
            value={next2}
            onChange={(e) => setNext2(e.target.value)}
            className={inputCls}
          />
          <button
            onClick={setPassword}
            disabled={!!busy || !ownerKey}
            className="rounded-xl bg-primary px-6 py-3 font-bold text-white transition-colors hover:bg-primary-strong disabled:opacity-50"
          >
            {busy === "set" ? "جارٍ الحفظ..." : protectedSite ? "🔄 غيّر كلمة السر" : "➕ فعّل الحماية"}
          </button>
        </div>
      </div>

      {/* إزالة كلمة السر */}
      {protectedSite && (
        <div className="mt-6 rounded-3xl border border-border-soft bg-surface-card p-6">
          <h2 className="font-extrabold">🔓 إزالة كلمة السر</h2>
          <p className="mt-1 text-sm text-muted">
            يفتح الموقع للجميع — أدخل كلمة السر الحالية للتأكيد.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="password"
              placeholder="كلمة السر الحالية"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputCls}
            />
            <button
              onClick={removePassword}
              disabled={!!busy || !current || !ownerKey}
              className="shrink-0 rounded-xl border border-primary px-6 py-3 font-bold text-primary transition-colors hover:bg-rose disabled:opacity-50"
            >
              {busy === "remove" ? "جارٍ الإزالة..." : "🗑️ أزل كلمة السر"}
            </button>
          </div>
        </div>
      )}

      </>)}

      <p className="mt-6 text-center text-xs leading-relaxed text-muted">
        الجلسة تدوم ٣٠ يوماً، وأي تغيير لكلمة السر يبطل كل الجلسات القديمة فوراً.
      </p>
    </div>
  );
}
