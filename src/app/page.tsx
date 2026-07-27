import Link from "next/link";
import WaveBars from "@/components/WaveBars";
import { MAQAMAT } from "@/lib/maqamat";

/** الخط الموجي القرمزي — التوقيع البصري للهوية */
function WaveLine({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 220 20"
      fill="none"
      className={`h-4 w-40 text-primary ${className}`}
    >
      <path
        d="M2 10 C 12 -6, 20 -6, 30 10 S 48 26, 58 10 S 76 -6, 86 10 S 104 26, 114 10 S 132 -6, 142 10 S 160 26, 170 10 S 188 -6, 198 10 S 210 18, 218 10"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** مشغّل صوتي ساكن للعرض داخل تكوين البطل */
function MockPlayer() {
  const bars = Array.from({ length: 46 }, (_, i) => {
    const a = Math.abs(Math.sin(i * 0.55) + 0.55 * Math.sin(i * 0.21) + 0.3 * Math.sin(i * 1.7));
    return Math.min(44, 8 + a * 26);
  });
  const played = Math.floor(bars.length * 0.42);
  return (
    <div className="card-lift w-full rounded-2xl border border-border-soft bg-surface-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-bold">الناتج الصوتي</p>
        <span className="rounded-full bg-rose px-3 py-1 text-xs font-semibold text-primary">وضع تجريبي</span>
      </div>
      <div dir="ltr" className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-sm text-white shadow-md shadow-primary/30">
          ▶
        </span>
        <span className="w-9 text-center text-xs tabular-nums text-faint">0:00</span>
        <div className="flex min-w-0 flex-1 items-center gap-[3px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className="min-w-[2.5px] flex-1 rounded-full"
              style={{ height: h, background: i < played ? "var(--primary)" : "#ead9d2" }}
            />
          ))}
        </div>
        <span className="w-9 text-center text-xs tabular-nums text-faint">1:47</span>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <span className="rounded-lg border border-primary/50 px-3 py-1.5 text-xs font-semibold text-primary">
          💾 احفظ في مكتبتي
        </span>
        <span className="rounded-lg border border-border-strong px-3 py-1.5 text-xs text-muted">⬇ تنزيل الملف</span>
      </div>
    </div>
  );
}

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
  { n: "٠١", title: "اكتب نصك", text: "إعلان، سرد، درس، بودكاست — حتى 5000 حرف بالفصحى أو لهجتك." },
  { n: "٠٢", title: "اختر الصوت", text: "أصوات رجالية ونسائية بطوابع مختلفة، واضبط السرعة والتعبير." },
  { n: "٠٣", title: "استمع وحمّل", text: "معاينة فورية وملف MP3 أو WAV بجودة عالية جاهز للاستخدام." },
];

const songSteps = [
  { n: "٠١", title: "اكتب كلماتك", text: "أو دع مساعد الذكاء الاصطناعي يكتب ويحسّن ويقترح عليك." },
  { n: "٠٢", title: "اختر المقام", text: "ثمانية مقامات بشخصياتها ومزاجها، مع الأسلوب والآلات الشرقية." },
  { n: "٠٣", title: "ولّد أغنيتك", text: "أغنية كاملة بغناء وتوزيع، أو موسيقى آلية خالصة بالمقام الذي تحب." },
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
  const tickerNames = [...MAQAMAT.map((m) => m.name), ...MAQAMAT.map((m) => m.name)];

  return (
    <div>
      {/* البطل غير المتمركز */}
      <section className="hero-glow">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 md:pt-20 lg:grid-cols-2">
          {/* عمود النص — يمين */}
          <div>
            <p className="flex items-center gap-2.5 text-sm font-bold text-primary">
              <span className="h-1 w-5 rounded-full bg-primary" />
              منصة عربية للصوتيات المولّدة بالذكاء الاصطناعي
            </p>
            <h1 className="mt-5 text-4xl font-extrabold leading-snug md:text-5xl md:leading-snug">
              حوّل كلماتك إلى
              <br />
              <span className="text-gradient">صوتٍ وأغنية.</span>
            </h1>
            <WaveLine className="mt-4" />
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
              اكتب نصك واختر الصوت واللهجة، أو اكتب كلماتك واختر المقام —
              والذكاء الاصطناعي يتكفّل بالباقي بجودة استوديو.
            </p>
            <div className="mt-9 flex flex-wrap gap-3.5">
              <Link
                href="/tts"
                className="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong hover:shadow-primary/40"
              >
                🎙️ جرّب النص إلى صوت
              </Link>
              <Link
                href="/songs"
                className="rounded-xl border border-border-strong bg-surface-card px-6 py-3 font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                🎼 استوديو الأغاني والمقامات
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-3 text-sm font-medium text-muted">
              <span>٨ مقامات أصيلة</span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>٢٠+ صوتاً عربياً</span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>فصحى ولهجات</span>
            </div>
          </div>

          {/* التكوين البصري — يسار */}
          <div className="relative mx-auto hidden h-[440px] w-full max-w-lg md:block">
            <div className="absolute right-10 top-4 h-[400px] w-[400px] rounded-full bg-rose" />
            <div className="absolute left-2 top-10 h-[400px] w-[400px] rounded-full border border-primary/25" />
            <div
              aria-hidden
              className="absolute bottom-6 right-0 grid grid-cols-5 gap-[18px] opacity-40"
            >
              {Array.from({ length: 25 }, (_, i) => (
                <span key={i} className="h-1 w-1 rounded-full bg-primary" />
              ))}
            </div>
            <div className="absolute left-1/2 top-1/2 w-[92%] -translate-x-1/2 -translate-y-1/2">
              <MockPlayer />
            </div>
            <div className="card-lift absolute left-1/2 top-3 flex -translate-x-1/2 rotate-3 gap-2 rounded-2xl border border-border-soft bg-surface-card p-3">
              <span className="rounded-full border border-border-strong bg-surface-card px-4 py-1.5 text-sm font-medium">راست</span>
              <span className="rounded-full border border-primary bg-rose px-4 py-1.5 text-sm font-medium text-primary">حجاز ✓</span>
              <span className="rounded-full border border-border-strong bg-surface-card px-4 py-1.5 text-sm font-medium">بياتي</span>
            </div>
            <div className="card-lift absolute bottom-2 left-1/2 flex -translate-x-1/4 -rotate-2 items-center gap-2.5 rounded-xl border border-border-soft bg-surface-card px-4 py-2.5">
              <span className="text-sm font-medium">صوت عمر — فصحى فخمة</span>
              <span className="text-sm font-bold text-gold">★ 4.9</span>
            </div>
          </div>
        </div>
      </section>

      {/* شريط المقامات النبيذي المتحرك */}
      <section aria-hidden className="overflow-hidden bg-wine py-3.5">
        <div className="ticker-track flex w-max items-center gap-7">
          {tickerNames.map((name, i) => (
            <span key={i} className="flex items-center gap-7">
              <span className="font-heading text-lg font-semibold text-cream/90">{name}</span>
              <span className="text-xs text-gold">✦</span>
            </span>
          ))}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* القسمان */}
        <section className="grid gap-6 py-16 md:grid-cols-2">
          <Link
            href="/tts"
            className="card-lift group rounded-3xl border border-border-soft bg-surface-card p-8 transition-all hover:-translate-y-1 hover:border-primary/60"
          >
            <div className="flex items-start justify-between">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose text-3xl">🎙️</span>
              <span className="font-heading text-5xl font-extrabold leading-none text-primary/20">٠١</span>
            </div>
            <h2 className="mt-5 text-2xl font-bold">استوديو النص إلى صوت</h2>
            <p className="mt-3 leading-relaxed text-muted">
              اكتب أي نص — إعلان، سرد، بودكاست، كتاب صوتي — واختر من أصوات عربية
              متعددة اللهجات، وتحكّم بالسرعة والنبرة ودرجة التعبير العاطفي.
            </p>
            <span className="mt-6 inline-block font-bold text-primary transition-transform group-hover:-translate-x-1">
              ← ابدأ التحويل
            </span>
          </Link>

          <Link
            href="/songs"
            className="card-lift group rounded-3xl border border-border-soft bg-surface-card p-8 transition-all hover:-translate-y-1 hover:border-primary/60"
          >
            <div className="flex items-start justify-between">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose text-3xl">🎼</span>
              <span className="font-heading text-5xl font-extrabold leading-none text-primary/20">٠٢</span>
            </div>
            <h2 className="mt-5 text-2xl font-bold">استوديو الأغاني والمقامات</h2>
            <p className="mt-3 leading-relaxed text-muted">
              اكتب كلماتك (أو دع الذكاء الاصطناعي يساعدك)، اختر المقام —
              بياتي، حجاز، راست، صبا... — والأسلوب والآلات، واحصل على أغنية كاملة.
            </p>
            <span className="mt-6 inline-block font-bold text-primary transition-transform group-hover:-translate-x-1">
              ← لحّن أغنيتك
            </span>
          </Link>
        </section>

        {/* كيف يعمل */}
        <section className="pb-16 pt-4">
          <div className="mb-12 flex flex-col items-center gap-3">
            <h2 className="text-center text-3xl font-extrabold">كيف يعمل؟</h2>
            <WaveLine />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { title: "🎙️ النص إلى صوت", steps: ttsSteps },
              { title: "🎼 الأغاني والمقامات", steps: songSteps },
            ].map((studio) => (
              <div key={studio.title} className="rounded-3xl border border-border-soft bg-surface-card p-8">
                <h3 className="mb-2 text-xl font-bold">{studio.title}</h3>
                <ol className="flex flex-col">
                  {studio.steps.map((s, i) => (
                    <li
                      key={s.n}
                      className={`flex items-start gap-5 py-5 ${i > 0 ? "border-t border-border-soft" : ""}`}
                    >
                      <span className="font-heading text-4xl font-extrabold leading-none text-primary/90">
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
      </div>

      {/* لماذا مقام — حزام رملي بعرض كامل */}
      <section className="bg-surface-raised py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 flex flex-col items-center gap-3">
            <h2 className="text-center text-3xl font-extrabold">لماذا مقام؟</h2>
            <WaveLine />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border-soft bg-surface-card p-6 transition-all hover:-translate-y-1 hover:border-primary/50"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-rose text-2xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* الأسئلة الشائعة — قائمة شعرية */}
        <section className="py-16">
          <h2 className="mb-10 text-center text-3xl font-extrabold">أسئلة شائعة</h2>
          <div className="mx-auto max-w-3xl divide-y divide-border-strong">
            {faqs.map((f) => (
              <details key={f.q} className="faq px-2 py-5">
                <summary className="flex items-center justify-between gap-4 font-bold">
                  {f.q}
                  <span className="faq-plus grid h-8 w-8 shrink-0 place-items-center rounded-full bg-rose text-base font-bold text-primary">
                    +
                  </span>
                  <span className="faq-minus h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-base font-bold text-white">
                    −
                  </span>
                </summary>
                <p className="mt-3 pl-12 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* دعوة ختامية نبيذية */}
        <section className="pb-20">
          <div className="relative overflow-hidden rounded-3xl bg-wine p-10 text-center text-cream md:p-16">
            <span
              aria-hidden
              className="absolute -right-24 -top-32 h-72 w-72 rounded-full border-[34px] border-cream/10"
            />
            <span
              aria-hidden
              className="absolute -bottom-24 -left-16 h-60 w-60 rounded-full border-[24px] border-gold/15"
            />
            <h2 className="relative text-3xl font-extrabold md:text-4xl">
              جاهز تسمع <span className="text-gold">كلماتك</span>؟
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-cream/80">
              ابدأ مجاناً الآن — اكتب أول نص أو أول أغنية ودع المنصة تفاجئك.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/tts"
                className="rounded-xl bg-cream px-8 py-3.5 font-bold text-wine transition-opacity hover:opacity-90"
              >
                ابدأ مجاناً
              </Link>
            </div>
            <WaveBars bars={24} tone="cream" className="relative mt-10 h-10 opacity-70" />
          </div>
        </section>
      </div>
    </div>
  );
}
