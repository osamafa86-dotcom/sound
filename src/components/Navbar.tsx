"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "الرئيسية" },
  { href: "/tts", label: "النص إلى صوت" },
  { href: "/songs", label: "استوديو الأغاني" },
  { href: "/library", label: "مكتبتي" },
  { href: "/pricing", label: "الأسعار" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border-soft bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-accent text-lg font-bold text-white">
            ♪
          </span>
          <span className="text-xl font-bold">
            مقام<span className="text-primary">.</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(link.href)
                  ? "bg-surface-card font-semibold text-body"
                  : "text-muted hover:text-body"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/tts"
            className="hidden rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-strong sm:block"
          >
            ابدأ الآن
          </Link>
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
        <nav className="border-t border-border-soft bg-surface px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`rounded-xl px-4 py-3 transition-colors ${
                  isActive(link.href)
                    ? "bg-surface-card font-semibold text-body"
                    : "text-muted hover:text-body"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/tts"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-xl bg-primary px-4 py-3 text-center font-semibold text-white"
            >
              ابدأ الآن
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
