import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border-soft bg-surface-raised/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2 text-lg font-bold">
            <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">♪</span>
            مقام
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted">
            استوديو الصوتيات بالذكاء الاصطناعي — نص إلى صوت عالي الجودة،
            وأغانٍ ملحّنة على المقامات العربية.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-muted">المنصة</p>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/tts" className="text-muted hover:text-body">استوديو النص إلى صوت</Link>
            <Link href="/songs" className="text-muted hover:text-body">استوديو الأغاني والمقامات</Link>
            <Link href="/library" className="text-muted hover:text-body">مكتبتي</Link>
            <Link href="/pricing" className="text-muted hover:text-body">الأسعار</Link>
          </nav>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-muted">المقامات</p>
          <p className="text-sm leading-loose text-muted">
            بياتي · حجاز · راست · صبا · كرد · نهاوند · عجم · سيكاه
          </p>
        </div>
      </div>
      <div className="border-t border-border-soft py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} مقام — جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
