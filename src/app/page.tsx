import Link from "next/link";
import {
  AudioLines,
  Brain,
  Images,
  Languages,
  Library,
  Mic,
  Music,
  Music4,
  Play,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import WaveBars from "@/components/WaveBars";
import WaveLine from "@/components/WaveLine";
import { MAQAMAT } from "@/lib/maqamat";

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
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-white shadow-md shadow-primary/30">
          <Play className="h-4 w-4 fill-white" strokeWidth={0} />
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

const features: { title: string; text: string; icon: LucideIcon }[] = [
  {
    title: "جودة استوديو",
    text: "محركات ذكاء اصطناعي من الطراز الأول: ElevenLabs وAzure وGoogle Lyria، بصوت 44.1kHz نقي.",
    icon: SlidersHorizontal,
  },
  {
    title: "عربي أولاً",
    text: "فصحى ولهجات (سعودية، مصرية، أردنية، إماراتية...) وواجهة عربية كاملة من اليمين لليسار.",
    icon: Languages,
  },
  {
    title: "مقامات حقيقية",
    text: "بياتي، حجاز، راست، صبا... طبقة ذكاء اصطناعي وسيطة تترجم المقام إلى برومبت موسيقي احترافي.",
    icon: Music4,
  },
  {
    title: "مكتبتك الخاصة",
    text: "كل ما تولّده يُحفظ في مكتبتك، جاهزاً للاستماع والتنزيل والمشاركة في أي وقت.",
    icon: Library,
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
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong hover:shadow-primary/40"
              >
                <Mic className="h-[18px] w-[18px]" strokeWidth={2} />
                جرّب النص إلى صوت
              </Link>
              <Link
                href="/songs"
                className="flex items-center gap-2 rounded-xl border border-border-strong bg-surface-card px-6 py-3 font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                <Music className="h-[18px] w-[18px] text-primary" strokeWidth={2} />
                استوديو الأغاني والمقامات
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
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose">
                <Mic className="h-7 w-7 text-primary" strokeWidth={1.7} />
              </span>
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
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-rose">
                <Music className="h-7 w-7 text-primary" strokeWidth={1.7} />
              </span>
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

        {/* اكتشف المزيد */}
        <section className="pb-16">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { href: "/gallery", icon: Images, title: "معرض الإبداعات", text: "استمع لأجمل ما ولّده المجتمع من أصوات وأغانٍ." },
              { href: "/voices", icon: AudioLines, title: "معرض الأصوات", text: "كتالوج الأصوات كاملاً — استمع وقارن واختر صوتك." },
              { href: "/prompts", icon: Sparkles, title: "وكيل البرومبتات", text: "مختبر يصوغ ويختبر برومبتات موسيقية احترافية." },
              { href: "/brain", icon: Brain, title: "عقل المنصة", text: "ذاكرة نطق تتعلم من تصحيحاتك وتتحسن مع الوقت." },
            ] as { href: string; icon: LucideIcon; title: string; text: string }[]).map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="group rounded-2xl border border-border-soft bg-surface-card p-5 transition-all hover:-translate-y-1 hover:border-primary/50"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-rose">
                    <s.icon className="h-5 w-5 text-primary" strokeWidth={1.8} />
                  </span>
                  <span className="text-primary opacity-0 transition-opacity group-hover:opacity-100">←</span>
                </div>
                <h3 className="mt-3 font-bold">{s.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.text}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* كيف يعمل */}
        <section className="pb-16 pt-4">
          <div className="mb-12 flex flex-col items-center gap-3">
            <h2 className="text-center text-3xl font-extrabold">كيف يعمل؟</h2>
            <WaveLine />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {([
              { title: "النص إلى صوت", icon: Mic, steps: ttsSteps },
              { title: "الأغاني والمقامات", icon: Music, steps: songSteps },
            ] as { title: string; icon: LucideIcon; steps: typeof ttsSteps }[]).map((studio) => (
              <div key={studio.title} className="rounded-3xl border border-border-soft bg-surface-card p-8">
                <h3 className="mb-2 flex items-center gap-2.5 text-xl font-bold">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-rose">
                    <studio.icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.9} />
                  </span>
                  {studio.title}
                </h3>
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

      {/* عقل المنصة */}
      <div className="mx-auto max-w-6xl px-4">
        <section className="pb-16">
          <div className="glow-card card-lift relative overflow-hidden rounded-3xl border border-primary/25 p-8 md:p-10">
            <div className="grid items-center gap-8 md:grid-cols-2">
              <div className="rounded-2xl border border-border-soft bg-surface p-6 text-center">
                <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-rose">
                  <Brain className="h-8 w-8 text-primary" strokeWidth={1.6} />
                </span>
                <p className="mt-4 font-heading text-lg font-bold">كل هذا التعلم مكشوف بشفافية</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  صفحة «العقل» تريك الإشارات المجمعة ودرجات النقد الذاتي وترتيب الأصوات
                  بأدلته وسلالات كل مقام — لا صندوق أسود.
                </p>
                <Link
                  href="/brain"
                  className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/25 transition-colors hover:bg-primary-strong"
                >
                  افتح لوحة العقل ←
                </Link>
              </div>
              <div>
                <p className="flex items-center gap-2.5 text-sm font-bold text-primary">
                  <span className="h-1 w-5 rounded-full bg-primary" />
                  عقل المنصة
                </p>
                <h2 className="mt-3 text-2xl font-extrabold md:text-3xl">
                  منصة تصير <span className="text-gradient">أذكى</span> مع كل استخدام
                </h2>
                <ul className="mt-5 flex flex-col gap-3.5 text-sm leading-relaxed text-muted">
                  {[
                    ["تتعلم من أفعالك:", "كل استماع كامل وحفظ ومشاركة وتقييم يصقل ترتيب الأصوات والإعدادات المقترحة."],
                    ["تنقد نفسها:", "تفرّغ عينات من الأصوات وتقيس دقة نطقها، وتستمع لعينات الأغاني وتحكم على التزامها المقامي."],
                    ["تتطور وحدها:", "وصفات المقامات سلالات تتنافس، وجلسة تأمل أسبوعية تولّد سلالات محسّنة وتُبقي الرابح."],
                    ["تعرفك شخصياً:", "صوتك المفضل ومقامك الأقرب وإعداداتك المريحة تصبح افتراضاتك في كل استوديو."],
                  ].map(([b, t]) => (
                    <li key={b} className="flex gap-2.5">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>
                        <span className="font-bold text-body">{b}</span> {t}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* لماذا لحّن — حزام رملي بعرض كامل */}
      <section className="bg-surface-raised py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 flex flex-col items-center gap-3">
            <h2 className="text-center text-3xl font-extrabold">لماذا لحّن؟</h2>
            <WaveLine />
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border-soft bg-surface-card p-6 transition-all hover:-translate-y-1 hover:border-primary/50"
              >
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-rose">
                  <f.icon className="h-[22px] w-[22px] text-primary" strokeWidth={1.8} />
                </span>
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
              <Link
                href="/brain"
                className="flex items-center gap-2 rounded-xl border border-cream/40 px-8 py-3.5 font-bold text-cream transition-colors hover:border-cream hover:bg-cream/10"
              >
                <Brain className="h-[18px] w-[18px]" strokeWidth={1.9} />
                شاهد ماذا تعلمت المنصة
              </Link>
            </div>
            <WaveBars bars={24} tone="cream" className="relative mt-10 h-10 opacity-70" />
          </div>
        </section>
      </div>
    </div>
  );
}
