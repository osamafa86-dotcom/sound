import Link from "next/link";

const features = [
  {
    title: "جودة استوديو",
    text: "محركات ذكاء اصطناعي من الطراز الأول: ElevenLabs وAzure وGoogle Lyria، بصوت 44.1kHz نقي.",
    icon: "🎚️",
  },
  {
    title: "عربي أولاً",
    text: "فصحى ولهجات (سعودية، مصرية، أردنية، إماراتية...) وواجهة عربية كاملة من اليمين لليسار.",
    icon: "🗣️",
  },
  {
    title: "مقامات حقيقية",
    text: "بياتي، حجاز، راست، صبا... طبقة ذكاء اصطناعي وسيطة تترجم المقام إلى برومبت موسيقي احترافي.",
    icon: "🎼",
  },
  {
    title: "مكتبتك الخاصة",
    text: "كل ما تولّده يُحفظ في مكتبتك، جاهزاً للاستماع والتنزيل والمشاركة في أي وقت.",
    icon: "📚",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      {/* Hero */}
      <section className="py-20 text-center md:py-28">
        <p className="mb-4 inline-block rounded-full border border-border-soft bg-surface-card px-4 py-1.5 text-sm text-muted">
          منصة عربية للصوتيات المولّدة بالذكاء الاصطناعي
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-6xl md:leading-tight">
          حوّل كلماتك إلى <span className="text-gradient">صوتٍ وأغنية</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
          اكتب نصك واختر الصوت واللهجة، أو اكتب كلماتك واختر المقام —
          والذكاء الاصطناعي يتكفّل بالباقي بجودة استوديو.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/tts"
            className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            جرّب النص إلى صوت
          </Link>
          <Link
            href="/songs"
            className="rounded-xl border border-border-soft bg-surface-card px-6 py-3 font-semibold transition-colors hover:border-primary"
          >
            استوديو الأغاني والمقامات
          </Link>
        </div>
      </section>

      {/* القسمان */}
      <section className="grid gap-6 pb-20 md:grid-cols-2">
        <Link
          href="/tts"
          className="glow-card group rounded-3xl border border-border-soft p-8 transition-colors hover:border-primary"
        >
          <span className="text-4xl">🎙️</span>
          <h2 className="mt-4 text-2xl font-bold">استوديو النص إلى صوت</h2>
          <p className="mt-3 leading-relaxed text-muted">
            اكتب أي نص — إعلان، سرد، بودكاست، كتاب صوتي — واختر من أصوات عربية
            متعددة اللهجات، وتحكّم بالسرعة والنبرة ودرجة التعبير العاطفي.
          </p>
          <span className="mt-6 inline-block font-semibold text-accent transition-transform group-hover:-translate-x-1">
            ← ابدأ التحويل
          </span>
        </Link>

        <Link
          href="/songs"
          className="glow-card group rounded-3xl border border-border-soft p-8 transition-colors hover:border-gold"
        >
          <span className="text-4xl">🎼</span>
          <h2 className="mt-4 text-2xl font-bold">استوديو الأغاني والمقامات</h2>
          <p className="mt-3 leading-relaxed text-muted">
            اكتب كلماتك (أو دع الذكاء الاصطناعي يساعدك)، اختر المقام —
            بياتي، حجاز، راست، صبا... — والأسلوب والآلات، واحصل على أغنية كاملة.
          </p>
          <span className="mt-6 inline-block font-semibold text-gold transition-transform group-hover:-translate-x-1">
            ← لحّن أغنيتك
          </span>
        </Link>
      </section>

      {/* المزايا */}
      <section className="border-t border-border-soft py-20">
        <h2 className="mb-12 text-center text-3xl font-bold">لماذا مقام؟</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border border-border-soft bg-surface-card p-6">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
