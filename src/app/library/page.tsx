import Link from "next/link";

export const metadata = { title: "مكتبتي" };

export default function Library() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold">مكتبتي</h1>
      <p className="mt-2 text-muted">كل ما تولّده من أصوات وأغانٍ سيُحفظ هنا.</p>

      <div className="mt-12 rounded-3xl border border-dashed border-border-soft bg-surface-card/50 p-16 text-center">
        <span className="text-5xl">📚</span>
        <h2 className="mt-4 text-xl font-bold">المكتبة فارغة حالياً</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          ستتفعّل المكتبة مع نظام الحسابات (المرحلة الرابعة) لتحفظ كل توليداتك
          وتعود إليها في أي وقت. جرّب الاستوديو الآن!
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/tts" className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-strong">
            النص إلى صوت
          </Link>
          <Link href="/songs" className="rounded-xl border border-border-soft px-5 py-2.5 text-sm font-semibold hover:border-gold">
            استوديو الأغاني
          </Link>
        </div>
      </div>
    </div>
  );
}
