"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase, supabaseConfigured } from "@/lib/supabase";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/tts", label: "النص إلى صوت" },
  { href: "/songs", label: "استوديو الأغاني" },
  { href: "/voice", label: "معمل الصوت" },
  { href: "/library", label: "مكتبتي" },
  { href: "/pricing", label: "الأسعار" },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await getSupabase()?.auth.signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-bold text-white">
            ♪
          </span>
          <span className="text-xl font-bold">
            مقام<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-surface-card font-semibold text-body"
                    : "text-muted hover:text-body"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {supabaseConfigured &&
            (email ? (
              <>
                <span
                  title={email}
                  className="hidden max-w-40 truncate rounded-full bg-surface-card px-3 py-1.5 text-xs text-muted sm:block"
                  dir="ltr"
                >
                  {email}
                </span>
                <button
                  onClick={signOut}
                  className="rounded-xl border border-border-soft px-3 py-2 text-sm text-muted transition-colors hover:text-body"
                >
                  خروج
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-xl border border-border-soft px-3 py-2 text-sm font-semibold transition-colors hover:border-primary"
              >
                دخول
              </Link>
            ))}
          <Link
            href="/tts"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            ابدأ الآن
          </Link>
        </div>
      </div>
    </header>
  );
}
