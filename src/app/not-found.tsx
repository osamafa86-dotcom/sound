import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="text-6xl">🎵</p>
      <h1 className="mt-5 text-3xl font-bold">هذه الصفحة خارج المقام</h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
        الرابط الذي فتحته غير موجود أو نُقل لمكان آخر — لكن الاستوديوهات كلها بانتظارك.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link
          href="/"
          className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
        >
          الصفحة الرئيسية
        </Link>
        <Link
          href="/tts"
          className="rounded-xl border border-border-soft px-6 py-3 font-semibold transition-colors hover:border-primary"
        >
          🎙️ استوديو النص إلى صوت
        </Link>
      </div>
    </div>
  );
}
