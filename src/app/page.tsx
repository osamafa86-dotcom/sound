import Link from "next/link";
import WaveBars from "@/components/WaveBars";
import { MAQAMAT } from "@/lib/maqamat";
import { PALESTINIAN_STYLES } from "@/lib/heritage/palestinian";

const stats = [
  { n: "٥٦", label: "صوتاً عربياً أصيلاً" },
  { n: "٢٠", label: "لهجة عربية" },
  { n: "٨", label: "مقامات بأرباع النغمات" },
  { n: "٧", label: "استوديوهات متكاملة" },
];

const studios = [
  {
    href: "/songs",
    icon: "🎼",
    title: "استوديو الأغاني والمقامات",
    text: "مساعد يؤلف كلماتك مقاطعَ مُهيكلة (مطلع، لازمة، جسر)، مدقق يشكّلها بلهجتك، وثمانية مقامات تسمع سلّم كلٍّ منها قبل الاختيار — ثم أغنية كاملة بغناء رجالي أو نسائي بلهجة الأداء التي تريد.",
    cta: "لحّن أغنيتك",
    color: "hover:border-gold",
    ctaColor: "text-gold",
  },
  {
    href: "/tts",
    icon: "🎙️",
    title: "استوديو النص إلى صوت",
    text: "٥٦ صوتاً في ٢٠ لهجة يرتبها ذكاء التقييمات، ومستشار صوتي يشكّل نصك تشكيلاً تاماً ويرشح الصوت والإعدادات — مع استنساخ صوتك وتصميم أصوات جديدة من وصف نصي.",
    cta: "حوّل نصك",
    color: "hover:border-primary",
    ctaColor: "text-accent",
  },
  {
    href: "/drama",
    icon: "🎭",
    title: "الاستوديو الدرامي",
    text: "الصق أي نص أو قصة فيتحول سيناريو إذاعياً متعدد الشخصيات: لكل شخصية صوتها المناسب جنساً وعمراً ولهجة، وينتج عملاً مسموعاً واحداً بإيقاع مشهدي محسوب.",
    cta: "أنتج عملك",
    color: "hover:border-accent",
    ctaColor: "text-accent",
  },
  {
    href: "/podcast",
    icon: "🎧",
    title: "استوديو البودكاست",
    text: "موضوع واحد يكفي — يكتب حواراً كاملاً بين مقدمَين بلهجتك المختارة وينتج الحلقة صوتياً بأصوات متناغمة، جاهزة للنشر.",
    cta: "سجّل حلقتك",
    color: "hover:border-primary",
    ctaColor: "text-accent",
  },
  {
    href: "/voice",
    icon: "🎤",
    title: "معمل الصوت",
    text: "سجّل بصوتك وحوّل الأداء لأي صوت من الكتالوج مع الحفاظ على النبرة والتوقيت، وفرّغ التسجيلات نصاً عربياً دقيقاً.",
    cta: "جرّب المعمل",
    color: "hover:border-primary",
    ctaColor: "text-accent",
  },
  {
    href: "/prompts",
    icon: "⚡",
    title: "مهندس البرومبتات",
    text: "اختصاصي صياغة لكل نوع مادة: خبر، سرد، صورة، فيديو، أغنية، بودكاست، إعلان — صف فكرتك بلغتك العادية واحصل على برومبت احترافي جاهز للصق في أي منصة.",
    cta: "اهندس برومبتك",
    color: "hover:border-accent",
    ctaColor: "text-accent",
  },
  {
    href: "/brain",
    icon: "🧠",
    title: "عقل المنصة",
    text: "شاهد ماذا تعلمت المنصة من الاستخدام الفعلي: ترتيب الأصوات وأدلته، درجات النقد الذاتي، وسلالات البرومبتات المتنافسة — بشفافية كاملة.",
    cta: "افتح اللوحة",
    color: "hover:border-primary",
    ctaColor: "text-primary",
  },
];

const songSteps = [
  {
    n: "١",
    title: "اكتب الفكرة واختر القالب",
    text: "المساعد يؤلف كلماتك مقاطعَ مُهيكلة بقالب الكتابة الذي تختار: دلعونا، عتابا، حداية، زجل... وباللهجة التي تريد — ثم «دقق وشكّل» يضبط كل حركة كما تُنطق بلهجتك.",
  },
  {
    n: "٢",
    title: "اختر المقام بأذنك",
    text: "اسمع سلّم كل مقام بأرباع نغماته قبل الاختيار، وأضف الأسلوب (ومنها قوالب التراث الفلسطيني) والأجواء الجاهزة: دف وطبل، إنشاد، مجوز ودبكة، أوركسترا.",
  },
  {
    n: "٣",
    title: "ولّد وتحكّم كالمحترفين",
    text: "مغنٍّ رجل أو امرأة بلهجة الأداء التي تحدد. بعد التوليد: بدّل المقام بضغطة، أعد غناء مقطع واحد، صحح نطق كلمة فيتعلمها العقل للأبد، وأضف كاريوكي وغلافاً ورابط مشاركة.",
  },
];

const ttsSteps = [
  {
    n: "١",
    title: "اكتب واستشر",
    text: "الصق نصك — إعلاناً أو سرداً أو كتاباً صوتياً — واستدعِ المستشار الصوتي: يشكّله تشكيلاً تاماً ويطبّع الأرقام والاختصارات ويرشح الصوت والإعدادات الأنسب.",
  },
  {
    n: "٢",
    title: "اختر من ٥٦ صوتاً",
    text: "كل اللهجات من المحيط إلى الخليج، والكتالوج يرتّب الأعلى رضاً أولاً ويطبق الإعدادات المتعلمة تلقائياً — أو استنسخ صوتك أنت.",
  },
  {
    n: "٣",
    title: "استمع وحمّل",
    text: "مشغّل بشكل الموجة، ملفات MP3/WAV بجودة استوديو، وحفظ في مكتبتك — وكل كلمة تعلّمها للمنصة تُنطق صحيحة في كل توليد قادم.",
  },
];

const features = [
  {
    icon: "🎼",
    title: "مقامات تسمعها قبل أن تختار",
    text: "ثمانية مقامات بتعريف موسيقي دقيق — أجناسها وأرباع نغماتها وإيقاعاتها — ولكلٍّ عينة مسموعة داخل الاستوديو.",
  },
  {
    icon: "🇵🇸",
    title: "ذاكرة التراث الفلسطيني",
    text: "دلعونا وعتابا وزريف الطول ودبكة موثقة ببنيتها الشعرية وآلاتها ونطقها الفلاحي — يكتب المساعد بها ويغني المحرك بروحها.",
  },
  {
    icon: "🧠",
    title: "عقل يتعلم من كل تفاعل",
    text: "كل استماع وحفظ وتقييم ومشاركة يصقل ترتيب الأصوات والإعدادات والبرومبتات — والمنصة تنقد نواتجها بنفسها آلياً.",
  },
  {
    icon: "🗣️",
    title: "نطق مضبوط ويُعلَّم",
    text: "مدقق يشكّل بلهجتك، وذاكرة نطق متراكمة: صحح كلمة مرة واحدة فتُنطق صحيحة للأبد في الأصوات والأغاني معاً.",
  },
  {
    icon: "🎚️",
    title: "جودة استوديو",
    text: "محركات الطراز الأول: ElevenLabs وGoogle Lyria وAzure — مع لمسة ماستر فورية تضبط الصوت وتقصّ الصمت.",
  },
  {
    icon: "🔄",
    title: "تحكم بلا إعادة من الصفر",
    text: "بدّل مقام الأغنية بضغطة، أعد توليد اللازمة وحدها، وقارن النسخ جنباً إلى جنب واحفظ الأجمل.",
  },
  {
    icon: "📡",
    title: "لا يضيع عمل أبداً",
    text: "توليداتك محفوظة على الخادم — أغلق الصفحة أثناء التوليد وارجع متى شئت لتجدها، ومكتبتك معك من أي جهاز.",
  },
  {
    icon: "🎤",
    title: "شارك كالفنانين",
    text: "كاريوكي يضيء الكلمات مع الغناء وتصدير SRT/LRC، غلاف ألبوم مولّد، ورابط مشاركة عام بصفحة استماع أنيقة.",
  },
];

const faqs = [
  {
    q: "كيف تضمنون سلامة النطق العربي؟",
    a: "بأربع طبقات: مدقق يشكّل النص تشكيلاً تاماً كما يُنطق بلهجتك (لا بالفصحى)، توجيه المحرك للأداء بلهجة «متحدث أصلي»، ذاكرة نطق متراكمة تُطبَّق على كل توليد، ونقد ذاتي آلي يقيس دقة نطق كل صوت باستمرار. وإن نشزت كلمة: «علّم وصحّح» يصلحها ويعلّمها المنصة للأبد.",
  },
  {
    q: "هل أستطيع تغيير مقام الأغنية بعد توليدها؟",
    a: "نعم — تحت كل أغنية شريط «نفس الأغنية بمقام آخر»: ضغطة واحدة تعيد التلحين بنفس الكلمات وكل الإعدادات بالمقام الجديد، وتبقى النسختان معاً للمقارنة. ويمكنك أيضاً إعادة توليد مقطع واحد فقط (اللازمة مثلاً) دون المساس بالباقي.",
  },
  {
    q: "ما قوالب التراث الفلسطيني المدعومة؟",
    a: "خمسة قوالب غنائية موثقة بحمضها الموسيقي الكامل: دلعونا، عتابا وميجانا، زريف الطول، دبكة شعبية، ووطنية فلسطينية — وسبعة قوالب كتابة شعرية منها الحداية والزجل والسحجة. اختيار أي قالب يضبط اللهجة والمقام الأليف تلقائياً.",
  },
  {
    q: "ماذا يعني أن للمنصة «عقلاً» يتعلم؟",
    a: "كل تفاعل — استماع كامل، حفظ، تنزيل، مشاركة، تقييم بالنجوم — إشارة تعلم تصقل ترتيب الأصوات والإعدادات المقترحة والبرومبتات. والمنصة تنقد نواتجها بنفسها: تفرّغ عينات من الأصوات وتقيس دقتها، وتستمع لعينات من الأغاني وتحكم على التزامها المقامي. كل ذلك معروض بشفافية في صفحة «العقل».",
  },
  {
    q: "هل الأصوات والأغاني مولّدة بالكامل؟",
    a: "نعم، بأحدث محركات الذكاء الاصطناعي وبواقعية يصعب تمييزها عن التسجيل البشري. الأصوات الـ٥٦ في الكتالوج لمتحدثين عرب أصليين بلهجاتهم الحقيقية — وليست أصواتاً أجنبية تنطق العربية بلكنة.",
  },
  {
    q: "هل أحتاج حساباً لأجرب؟",
    a: "لا — جرّب كل الاستوديوهات دون تسجيل. الحساب المجاني يضيف: مكتبة تحفظ أعمالك من أي جهاز، حدود استخدام أعلى (٣ أضعاف)، سجل توليداتك على الخادم، واقتراحات شخصية تتعلم ذوقك.",
  },
  {
    q: "أغلقت الصفحة أثناء التوليد — هل ضاعت أغنيتي؟",
    a: "لا. التوليد يعمل على خوادمنا لا في متصفحك — افتح «توليداتك الأخيرة» في استوديو الأغاني وسترى مهامك: استرجع المكتملة أو تابع الجارية من حيث توقفت.",
  },
  {
    q: "هل يمكنني استخدام الناتج تجارياً؟",
    a: "نعم مع الباقات المدفوعة — المحركات التي نعتمدها مرخّصة تجارياً، وتفاصيل الترخيص تُعرض في صفحة الأسعار عند إطلاق الباقات.",
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="hero-glow">
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-20 text-center md:pt-28">
          <p className="mb-4 inline-block rounded-full border border-border-soft bg-surface-card px-4 py-1.5 text-sm text-muted">
            ✨ منصة الصوتيات العربية بعقلٍ يتعلم منك
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-bold leading-tight md:text-6xl md:leading-tight">
            من الكلمة إلى <span className="text-gradient">الأغنية الكاملة</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            أصوات بكل اللهجات، أغانٍ بالمقامات الأصيلة وقوالب التراث الفلسطيني،
            دراما وبودكاست — ومنصة تتعلم من كل استماع لتصير أذكى في كل مرة.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/songs"
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong hover:shadow-primary/40"
            >
              🎼 لحّن أول أغنية
            </Link>
            <Link
              href="/tts"
              className="rounded-xl border border-border-soft bg-surface-card px-6 py-3 font-semibold transition-colors hover:border-gold"
            >
              🎙️ حوّل نصك إلى صوت
            </Link>
          </div>

          <div className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl border border-border-soft bg-surface-card/60 px-4 py-3">
                <p className="text-2xl font-bold text-gradient">{s.n}</p>
                <p className="mt-0.5 text-xs text-muted">{s.label}</p>
              </div>
            ))}
          </div>
          <WaveBars className="mt-12 h-16" />
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4">
        {/* الاستوديوهات الستة */}
        <section className="py-16">
          <h2 className="mb-2 text-center text-3xl font-bold">سبعة استوديوهات في منصة واحدة</h2>
          <p className="mb-10 text-center text-muted">كل ما يحتاجه صانع المحتوى العربي — من التعليق الصوتي إلى الأغنية الكاملة</p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {studios.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className={`glow-card group rounded-3xl border border-border-soft p-7 transition-all hover:-translate-y-1 ${s.color}`}
              >
                <span className="text-4xl">{s.icon}</span>
                <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{s.text}</p>
                <span className={`mt-5 inline-block text-sm font-semibold ${s.ctaColor} transition-transform group-hover:-translate-x-1`}>
                  ← {s.cta}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* التراث الفلسطيني */}
        <section className="rounded-3xl border border-gold/30 bg-surface-card/60 p-8 md:p-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">🇵🇸 ذاكرة التراث الغنائي الفلسطيني</h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-muted">
                ليست «لكنة» تضاف على الغناء — بل قوالب موثقة ببنيتها الشعرية وآلاتها
                وإيقاعاتها ونطقها الفلاحي: المساعد يكتب رباعيات الدلعونا بلازمتها،
                وجناس العتابا بأصوله، والمحرك يغنيها بمجوزها ودبكتها وسحجتها.
              </p>
            </div>
            <Link
              href="/songs"
              className="rounded-xl bg-gold px-5 py-2.5 text-sm font-semibold text-surface transition-opacity hover:opacity-90"
            >
              جرّب قالباً تراثياً ←
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {PALESTINIAN_STYLES.map((s) => (
              <span key={s.id} className="rounded-full border border-gold/40 bg-surface px-4 py-2 text-sm">
                {s.name}
              </span>
            ))}
            <span className="rounded-full border border-border-soft bg-surface px-4 py-2 text-sm text-muted">
              + قوالب كتابة: حداية · زجل · سحجة · ميجانا
            </span>
          </div>
        </section>

        {/* شريط المقامات */}
        <section className="mt-6 rounded-3xl border border-border-soft bg-surface-card/60 p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">ثمانية مقامات تختارها بأذنك</h2>
              <p className="mt-1 text-sm text-muted">
                لكل مقام تعريف موسيقي دقيق بأجناسه وأرباع نغماته — وزر «🔊 اسمع السلّم» يعزفه لك قبل الاختيار
              </p>
            </div>
            <Link href="/songs" className="text-sm font-semibold text-gold hover:underline">
              اسمعها في الاستوديو ←
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
              { title: "🎼 الأغاني والمقامات", steps: songSteps, color: "text-gold" },
              { title: "🎙️ النص إلى صوت", steps: ttsSteps, color: "text-accent" },
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

        {/* عقل المنصة */}
        <section className="rounded-3xl border border-primary/30 bg-surface-card/60 p-8 md:p-10">
          <div className="grid items-center gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold">🧠 منصة تصير أذكى مع كل استخدام</h2>
              <ul className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-muted">
                <li>
                  <span className="font-semibold text-body">تتعلم من أفعالك:</span> كل استماع كامل
                  وحفظ ومشاركة وتقييم يصقل ترتيب الأصوات والإعدادات المقترحة.
                </li>
                <li>
                  <span className="font-semibold text-body">تنقد نفسها:</span> تفرّغ عينات من
                  الأصوات وتقيس دقة نطقها، وتستمع لعينات الأغاني وتحكم على التزامها المقامي.
                </li>
                <li>
                  <span className="font-semibold text-body">تتطور وحدها:</span> وصفات المقامات
                  سلالات تتنافس، وجلسة تأمل أسبوعية تولّد سلالات محسّنة وتُبقي الرابح.
                </li>
                <li>
                  <span className="font-semibold text-body">تعرفك شخصياً:</span> صوتك المفضل
                  ومقامك الأقرب وإعداداتك المريحة تصبح افتراضاتك في كل استوديو.
                </li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border-soft bg-surface p-6 text-center">
              <p className="text-5xl">📊</p>
              <p className="mt-3 font-semibold">كل هذا التعلم مكشوف بشفافية</p>
              <p className="mt-2 text-sm text-muted">
                صفحة «العقل» تريك الإشارات المجمعة ودرجات النقد الذاتي وترتيب الأصوات
                بأدلته وسلالات كل مقام — لا صندوق أسود.
              </p>
              <Link
                href="/brain"
                className="mt-4 inline-block rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-strong"
              >
                افتح لوحة العقل ←
              </Link>
            </div>
          </div>
        </section>

        {/* المزايا */}
        <section className="py-20">
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
              جاهز تسمع <span className="text-gradient">كلماتك تُغنّى</span>؟
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-muted">
              ابدأ مجاناً الآن — دلعونا من فكرة، أو تعليق صوتي بلهجتك، أو حلقة بودكاست كاملة.
              وكل ما تولّده يجعل المنصة أذكى.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/songs"
                className="rounded-xl bg-primary px-8 py-3.5 font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-strong"
              >
                ابدأ مجاناً
              </Link>
              <Link
                href="/brain"
                className="rounded-xl border border-border-soft px-8 py-3.5 font-semibold transition-colors hover:border-primary"
              >
                🧠 شاهد ماذا تعلمت المنصة
              </Link>
            </div>
            <WaveBars bars={24} className="mt-10 h-10 opacity-60" />
          </div>
        </section>
      </div>
    </div>
  );
}
