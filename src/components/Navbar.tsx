"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** مجموعات القائمة الجانبية — قابلة للنمو بلا ازدحام بفضل التمرير */
const groups: { label: string | null; items: { href: string; label: string; icon: string }[] }[] = [
  {
    label: null,
    items: [{ href: "/", label: "الرئيسية", icon: "🏠" }],
  },
  {
    label: "الاستوديوهات",
    items: [
      { href: "/tts", label: "النص إلى صوت", icon: "🎙️" },
      { href: "/songs", label: "استوديو الأغاني", icon: "🎼" },
      { href: "/drama", label: "الاستوديو الدرامي", icon: "🎭" },
      { href: "/podcast", label: "البودكاست", icon: "🎧" },
      { href: "/voice", label: "معمل الصوت", icon: "🔬" },
    ],
  },
  {
    label: "الاستكشاف",
    items: [
      { href: "/voices", label: "معرض الأصوات", icon: "🎤" },
      { href: "/gallery", label: "معرض الإبداعات", icon: "🖼️" },
      { href: "/prompts", label: "وكيل البرومبتات", icon: "✨" },
      { href: "/brain", label: "عقل المنصة", icon: "🧠" },
    ],
  },
  {
    label: "حسابي",
    items: [
      { href: "/library", label: "مكتبتي", icon: "📚" },
      { href: "/pricing", label: "الأسعار", icon: "💳" },
      { href: "/support", label: "الدعم والتواصل", icon: "🛟" },
    ],
  },
];

function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex items-center justify-center gap-[3px] rounded-xl bg-primary"
      style={{ width: size, height: size }}
    >
      {[0.3, 0.55, 0.38, 0.6].map((f, i) => (
        <span key={i} className="w-[3px] rounded-full bg-white" style={{ height: size * f }} />
      ))}
    </span>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user?.email ?? null)
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // رابط لوحة النظام يظهر لمالك المنصة وحده — الخادم وحده يقرر ذلك
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((d) => !cancelled && setIsOwner(!!d.owner))
      .catch(() => !cancelled && setIsOwner(false));
    return () => {
      cancelled = true;
    };
  }, [email]);

  // إغلاق الدرج عند تغيّر الصفحة (نمط التعديل أثناء التصيير)
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) setOpen(false);
  }

  const visibleGroups =
    isOwner && email
      ? [...groups, { label: "الإدارة", items: [{ href: "/admin", label: "لوحة النظام", icon: "🛡️" }] }]
      : groups;

  async function signOut() {
    await createClient()?.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const navList = (
    <nav className="nav-scroll flex-1 overflow-y-auto px-3 py-2">
      {visibleGroups.map((g, gi) => (
        <div key={g.label ?? gi}>
          {g.label && (
            <p className="px-3 pb-1 pt-4 text-[11px] font-bold uppercase tracking-wide text-faint">
              {g.label}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {g.items.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive(link.href)
                    ? "bg-rose font-bold text-primary"
                    : "text-muted hover:bg-surface-raised hover:text-body"
                }`}
              >
                <span className="text-base leading-none">{link.icon}</span>
                {link.label}
                {isActive(link.href) && (
                  <span className="ms-auto h-5 w-1 rounded-full bg-primary" />
                )}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const account = (
    <div className="border-t border-border-soft p-3">
      {email ? (
        <div className="flex flex-col gap-2">
          <p className="truncate px-1 text-xs text-muted" title={email}>
            {email}
          </p>
          <button
            onClick={signOut}
            className="rounded-xl border border-border-strong px-3 py-2 text-sm font-semibold transition-colors hover:border-primary hover:text-primary"
          >
            خروج
          </button>
        </div>
      ) : (
        <Link
          href="/login"
          onClick={() => setOpen(false)}
          className="block rounded-xl bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white shadow-md shadow-primary/25 transition-colors hover:bg-primary-strong"
        >
          تسجيل الدخول
        </Link>
      )}
    </div>
  );

  return (
    <>
      {/* الشريط الجانبي — الشاشات الكبيرة */}
      <aside className="fixed inset-y-0 start-0 z-40 hidden w-[264px] flex-col border-e border-border-soft bg-surface-card lg:flex">
        <Link href="/" className="flex items-center gap-2.5 border-b border-border-soft px-5 py-4">
          <LogoMark size={38} />
          <span className="font-heading text-xl font-extrabold">
            مقام<span className="text-primary">.</span>
          </span>
        </Link>
        {navList}
        {account}
      </aside>

      {/* الشريط العلوي الرفيع — الجوال */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border-soft bg-surface-card/95 px-4 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <LogoMark size={32} />
          <span className="font-heading text-lg font-extrabold">
            مقام<span className="text-primary">.</span>
          </span>
        </Link>
        <button
          onClick={() => setOpen(!open)}
          aria-label="القائمة"
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border-soft text-xl"
        >
          {open ? "✕" : "☰"}
        </button>
      </header>

      {/* درج الجوال */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-body/30 backdrop-blur-[2px] lg:hidden"
            onClick={() => setOpen(false)}
          />
          <aside className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col border-e border-border-soft bg-surface-card shadow-2xl lg:hidden">
            <div className="flex items-center justify-between border-b border-border-soft px-4 py-3.5">
              <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                <LogoMark size={32} />
                <span className="font-heading text-lg font-extrabold">
                  مقام<span className="text-primary">.</span>
                </span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="grid h-9 w-9 place-items-center rounded-lg border border-border-soft"
              >
                ✕
              </button>
            </div>
            {navList}
            {account}
          </aside>
        </>
      )}
    </>
  );
}
