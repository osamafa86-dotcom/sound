import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-wine text-cream">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-3">
        <div>
          <p className="flex items-center gap-2.5 font-heading text-lg font-bold">
            <span aria-hidden className="flex h-8 w-8 items-center justify-center gap-[2.5px] rounded-lg bg-cream">
              {[9, 17, 12, 19].map((h, i) => (
                <span key={i} className="w-[2.5px] rounded-full bg-wine" style={{ height: h }} />
              ))}
            </span>
            مقام
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream/70">
            استوديو الصوتيات بالذكاء الاصطناعي — نص إلى صوت عالي الجودة،
            وأغانٍ ملحّنة على المقامات العربية.
          </p>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-gold">المنصة</p>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/tts" className="text-muted hover:text-body">استوديو النص إلى صوت</Link>
            <Link href="/songs" className="text-muted hover:text-body">استوديو الأغاني والمقامات</Link>
            <Link href="/gallery" className="text-muted hover:text-body">معرض الإبداعات</Link>
            <Link href="/library" className="text-muted hover:text-body">مكتبتي</Link>
            <Link href="/pricing" className="text-muted hover:text-body">الأسعار</Link>
            <Link href="/support" className="text-muted hover:text-body">الدعم والتواصل</Link>
          </nav>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-gold">المقامات</p>
          <p className="text-sm leading-loose text-cream/75">
            بياتي · حجاز · راست · صبا · كرد · نهاوند · عجم · سيكاه
          </p>
        </div>
      </div>
      <div className="border-t border-cream/20 py-5 text-center text-xs text-cream/60">
        © {new Date().getFullYear()} مقام — جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
