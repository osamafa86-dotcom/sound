import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border-soft bg-surface-raised/60">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center md:flex-row md:justify-between md:text-start">
        <div>
          <p className="font-semibold">مقام — استوديو الصوتيات بالذكاء الاصطناعي</p>
          <p className="mt-1 text-sm text-muted">
            نص إلى صوت عالي الجودة، وأغانٍ ملحّنة على المقامات العربية.
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-muted">
          <Link href="/tts" className="hover:text-body">النص إلى صوت</Link>
          <Link href="/songs" className="hover:text-body">استوديو الأغاني</Link>
          <Link href="/pricing" className="hover:text-body">الأسعار</Link>
        </nav>
      </div>
    </footer>
  );
}
