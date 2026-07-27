"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/tts", label: "النص إلى صوت" },
  { href: "/voices", label: "الأصوات" },
  { href: "/songs", label: "استوديو الأغاني" },
  { href: "/drama", label: "الاستوديو الدرامي" },
  { href: "/podcast", label: "البودكاست" },
  { href: "/voice", label: "معمل الصوت" },
  { href: "/prompts", label: "البرومبتات" },
  { href: "/gallery", label: "المعرض" },
  { href: "/library", label: "مكتبتي" },
  { href: "/brain", label: "🧠 العقل" },
  { href: "/pricing", label: "الأسعار" },
];

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

  // اشتراط البريد أيضاً يخفي الرابط فور الخروج بلا انتظار جواب الخادم
  const visibleLinks =
    isOwner && email ? [...links, { href: "/admin", label: "لوحة النظام" }] : links;

  async function signOut() {
    await createClient()?.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-surface-card/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
          <span aria-hidden className="flex h-9 w-9 items-center justify-center gap-[3px] rounded-xl bg-primary">
            {[11, 20, 14, 22].map((h, i) => (
              <span key={i} className="w-[3px] rounded-full bg-white" style={{ height: h }} />
            ))}
          </span>
          <span className="font-heading text-xl font-extrabold">
            مقام<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-rose font-bold text-primary"
                  : "text-muted hover:text-body"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {email ? (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[140px] truncate text-xs text-muted" title={email}>
                {email}
              </span>
              <button
                onClick={signOut}
                className="rounded-xl border border-border-soft px-3 py-2 text-sm transition-colors hover:border-primary"
              >
                خروج
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-colors hover:bg-primary-strong sm:block"
            >
              دخول
            </Link>
          )}
          <button
            onClick={() => setOpen(!open)}
            aria-label="القائمة"
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-xl border border-border-soft text-xl md:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* قائمة الموبايل */}
      {open && (
        <nav className="border-t border-border-soft bg-surface-card px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {visibleLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-3 transition-colors ${
                  isActive(link.href)
                    ? "bg-rose font-bold text-primary"
                    : "text-muted hover:text-body"
                }`}
              >
                {link.label}
              </Link>
            ))}
            {email ? (
              <button
                onClick={signOut}
                className="mt-2 rounded-xl border border-border-soft px-4 py-3 text-center font-semibold"
              >
                خروج ({email})
              </button>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white"
              >
                تسجيل الدخول
              </Link>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
