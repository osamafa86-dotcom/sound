import Link from "next/link";
import WaveBars from "@/components/WaveBars";
import { MAQAMAT } from "@/lib/maqamat";

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

const ttsSteps = [
  { n: "١", title: "اكتب نصك", text: "إعلان، سرد، درس، بودكاست — حتى 5000 حرف بالفصحى أو لهجتك." },
  { n: "٢", title: "اختر الصوت", text: "أصوات رجالية ونسائية بطوابع مختلفة، واضبط السرعة والتعبير." },
  { n: "٣", title: "استمع وحمّل", text: "معاينة فورية وملف MP3 أو WAV بجودة عالية جاهز للاستخدام." },
];

const songSteps = [
  { n: "١", title: "اكتب كلماتك", text: "أو دع مساعد الذكاء الاصطناعي يكتب ويحسّن ويقترح عليك." },
  { n: "٢", title: "اختر المقام", text: "ثمانية مقامات بشخصياتها ومزاجها، مع الأسلوب والآلات الشرقية." },
  { n: "٣", title: "ولّد أغنيتك", text: "أغنية كاملة بغناء وتوزيع، أو موسيقى آلية خالصة بالمقام الذي تحب." },
];

const faqs = [
  {
    q: "هل الأصوات حقيقية أم مولّدة؟",
    a: "الأصوات مولّدة بالكامل بأحدث محركات الذكاء الاصطناعي، وتصل واقعيتها حداً يصعب تمييزه عن التسجيل البشري — دون الحاجة لاستوديو أو معلّق صوتي.",
  },
  {
    q: "هل يفهم الموقع المقامات العربية فعلاً؟",
    a: "نعم. لكل مقام في المنصة تعريف موسيقي دقيق بدرجاته وأرباع نغماته، وطبقة ذكاء اصطناعي وسيطة تحوّل اختيارك إلى وصف موسيقي احترافي يفهمه محرك التوليد.",
  },
  {
    q: "هل يمكنني استخدام الناتج تجارياً؟",
    a: "نعم مع الباقات المدفوعة — المحركات التي نعتمدها مرخّصة تجارياً، وسنوضح تفاصيل الترخيص في صفحة الأسعار عند إطلاق الباقات.",
  },
  {
    q: "ما اللهجات المدعومة في تحويل النص إلى صوت؟",
    a: "الفصحى بجودة ممتازة اليوم، ولهجات خليجية ومصرية وشامية عبر شركائنا التقنيين — وتتوسع القائمة باستمرار.",
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="hero-glow">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center md:pt-28">
          <p className="mb-4 inline-block rounded-full border border-border-soft bg-surface-card px-4 py-1.5 text-sm text-muted">
            ✨ منصة عربية للصوتيات المولّدة بالذكاء الاصطناعي
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
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong hover:shadow-primary/40"
            >
              🎙️ جرّب النص إلى صوت
            </Link>
            <Link
              href="/songs"
              className="rounded-xl border border-border-soft bg-surface-card px-6 py-3 font-semibold transition-colors hover:border-gold"
            >
              🎼 استوديو الأغاني والمقامات
            </Link>
          </div>
          <WaveBars className="mt-14 h-16" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* القسمان */}
        <section className="grid gap-6 py-16 md:grid-cols-2">
          <Link
            href="/tts"
            className="glow-card group rounded-3xl border border-border-soft p-8 transition-all hover:-translate-y-1 hover:border-primary"
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
            className="glow-card group rounded-3xl border border-border-soft p-8 transition-all hover:-translate-y-1 hover:border-gold"
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

        {/* شريط المقامات */}
        <section className="rounded-3xl border border-border-soft bg-surface-card/60 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">ثمانية مقامات بشخصياتها الكاملة</h2>
              <p className="mt-1 text-sm text-muted">كل مقام بدرجاته وأرباع نغماته ومزاجه الموسيقي</p>
            </div>
            <Link href="/songs" className="text-sm font-semibold text-gold hover:underline">
              جرّبها في الاستوديو ←
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {MAQAMAT.map((m) => (
              <span
                key={m.id}
                className="rounded-full border border-border-soft bg-surface px-4 py-2 text-sm"
                title={m.mood}
              >
                {m.name}
                <span className="mx-1.5 text-xs text-muted">{m.mood.split("،")[0]}</span>
              </span>
            ))}
          </div>
        </section>

        {/* كيف يعمل */}
        <section className="py-20">
          <h2 className="mb-12 text-center text-3xl font-bold">كيف يعمل؟</h2>
          <div className="grid gap-10 lg:grid-cols-2">
            {[
              { title: "🎙️ النص إلى صوت", steps: ttsSteps, color: "text-accent" },
              { title: "🎼 الأغاني والمقامات", steps: songSteps, color: "text-gold" },
            ].map((studio) => (
              <div key={studio.title} className="rounded-3xl border border-border-soft bg-surface-card p-8">
                <h3 className="mb-6 text-xl font-bold">{studio.title}</h3>
                <ol className="flex flex-col gap-5">
                  {studio.steps.map((s) => (
                    <li key={s.n} className="flex gap-4">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border-soft bg-surface text-lg font-bold ${studio.color}`}>
                        {s.n}
                      </span>
                      <div>
                        <p className="font-bold">{s.title}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">{s.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </section>

        {/* المزايا */}
        <section className="border-t border-border-soft py-20">
          <h2 className="mb-12 text-center text-3xl font-bold">لماذا مقام؟</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border-soft bg-surface-card p-6 transition-all hover:-translate-y-1 hover:border-primary/50"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* الأسئلة الشائعة */}
        <section className="border-t border-border-soft py-20">
          <h2 className="mb-10 text-center text-3xl font-bold">أسئلة شائعة</h2>
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {faqs.map((f) => (
              <details key={f.q} className="faq rounded-2xl border border-border-soft bg-surface-card px-6 py-4">
                <summary className="flex items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span className="faq-chevron text-muted transition-transform">⌄</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* دعوة ختامية */}
        <section className="pb-20">
          <div className="glow-card relative overflow-hidden rounded-3xl border border-border-soft p-10 text-center md:p-16">
            <h2 className="text-3xl font-bold md:text-4xl">
              جاهز تسمع <span className="text-gradient">كلماتك</span>؟
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">
              ابدأ مجاناً الآن — اكتب أول نص أو أول أغنية ودع المنصة تفاجئك.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/tts"
                className="rounded-xl bg-primary px-8 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong"
              >
                ابدأ مجاناً
              </Link>
            </div>
            <WaveBars bars={24} className="mt-10 h-10 opacity-60" />
          </div>
        </section>
      </div>
    </div>
  );
}
