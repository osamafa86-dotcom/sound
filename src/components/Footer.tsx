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
            <Link href="/tts" className="text-cream/75 transition-colors hover:text-cream">استوديو النص إلى صوت</Link>
            <Link href="/songs" className="text-cream/75 transition-colors hover:text-cream">استوديو الأغاني والمقامات</Link>
            <Link href="/voices" className="text-cream/75 transition-colors hover:text-cream">معرض الأصوات</Link>
            <Link href="/gallery" className="text-cream/75 transition-colors hover:text-cream">معرض الإبداعات</Link>
            <Link href="/drama" className="text-cream/75 transition-colors hover:text-cream">الاستوديو الدرامي</Link>
            <Link href="/podcast" className="text-cream/75 transition-colors hover:text-cream">البودكاست الذكي</Link>
            <Link href="/prompts" className="text-cream/75 transition-colors hover:text-cream">وكيل البرومبتات</Link>
            <Link href="/library" className="text-cream/75 transition-colors hover:text-cream">مكتبتي</Link>
            <Link href="/pricing" className="text-cream/75 transition-colors hover:text-cream">الأسعار</Link>
            <Link href="/support" className="text-cream/75 transition-colors hover:text-cream">الدعم والتواصل</Link>
          </nav>
        </div>
        <div>
          <p className="mb-3 text-sm font-bold text-gold">المقامات</p>
          <p className="text-sm leading-loose text-cream/75">
            بياتي · حجاز · راست · صبا · كرد · نهاوند · عجم · سيكاه
          </p>
          <p className="mb-3 mt-6 text-sm font-bold text-gold">قانوني</p>
          <nav className="flex flex-col gap-2 text-sm">
            <Link href="/terms" className="text-cream/75 transition-colors hover:text-cream">شروط الاستخدام</Link>
            <Link href="/privacy" className="text-cream/75 transition-colors hover:text-cream">سياسة الخصوصية</Link>
            <Link href="/refund" className="text-cream/75 transition-colors hover:text-cream">سياسة الاسترجاع</Link>
          </nav>
        </div>
      </div>
      <div className="border-t border-cream/20 py-5 text-center text-xs text-cream/60">
        © {new Date().getFullYear()} مقام — جميع الحقوق محفوظة
      </div>
    </footer>
  );
}
