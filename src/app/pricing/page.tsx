import Link from "next/link";
import { CREDIT_COSTS, FREE_MONTHLY_CREDITS } from "@/lib/credits";

export const metadata = { title: "الأسعار" };

/**
 * الباقات مبنية على نظام النقاط الفعلي المفعَّل في الخادم —
 * لا وعود معلّقة: المجانية تعمل الآن، والمدفوعتان بالتواصل حتى تفعيل بوابة الدفع.
 */
const plans = [
  {
    name: "مجاني",
    price: "0$",
    period: "دائماً",
    credits: `${FREE_MONTHLY_CREDITS} نقطة شهرياً`,
    features: [
      "تتجدد تلقائياً مطلع كل شهر",
      "كل الأصوات واللهجات والمقامات",
      "المحرك التعبيري v3 بكل أساليبه",
      "مكتبة خاصة + النشر في المعرض",
      "عقل المنصة يتعلم ذوقك",
    ],
    cta: { label: "ابدأ مجاناً الآن", href: "/login?mode=signup" },
    highlight: false,
  },
  {
    name: "المبدع",
    price: "قريباً",
    period: "شهرياً",
    credits: "٥٬٠٠٠ نقطة شهرياً",
    features: [
      "عشرة أضعاف الباقة المجانية",
      "أولوية في طوابير التوليد",
      "استخدام تجاري للمخرجات",
      "أغانٍ كاملة ومسلسلات صوتية بلا قلق",
      "دعم مباشر بأولوية",
    ],
    cta: { label: "اطلب ترقية مبكرة", href: "/support" },
    highlight: true,
  },
  {
    name: "الاستوديو",
    price: "قريباً",
    period: "شهرياً",
    credits: "٢٠٬٠٠٠ نقطة شهرياً",
    features: [
      "كل مزايا المبدع",
      "حجم إنتاج استوديوهات ووكالات",
      "أصوات مستنسخة بلا حدود عملية",
      "وصول API خاص (عند التوفر)",
      "قناة دعم مخصصة",
    ],
    cta: { label: "تواصل معنا", href: "/support" },
    highlight: false,
  },
];

/** أسماء عربية لمسارات الاستهلاك — لعرض جدول التكلفة من مصدره الحقيقي */
const COST_LABELS: { key: keyof typeof CREDIT_COSTS; label: string; icon: string }[] = [
  { key: "tts", label: "توليد صوت من نص", icon: "🎙️" },
  { key: "songs", label: "أغنية كاملة", icon: "🎼" },
  { key: "drama", label: "حلقة بودكاست / عمل درامي", icon: "🎧" },
  { key: "voiceClone", label: "استنساخ صوتك", icon: "🧬" },
  { key: "voiceDesign", label: "تصميم صوت جديد", icon: "🎨" },
  { key: "sts", label: "تحويل صوت إلى صوت", icon: "🎭" },
  { key: "isolate", label: "عزل الصوت من الضجيج", icon: "🧹" },
  { key: "stt", label: "تفريغ نصي", icon: "📝" },
  { key: "cover", label: "غلاف بالذكاء الاصطناعي", icon: "🖼️" },
  { key: "promptTest", label: "تجربة برومبت صورة", icon: "🧪" },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-center text-3xl font-bold">الأسعار</h1>
      <p className="mx-auto mt-2 max-w-xl text-center leading-relaxed text-muted">
        نظام نقاط واحد وواضح: كل عملية تخصم من رصيدك حسب كلفتها الحقيقية —
        والمساعدات الذكية (تشكيل، تدقيق، كتابة كلمات، وكيل البرومبتات) مجانية دائماً.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col rounded-3xl border p-8 ${
              p.highlight
                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                : "border-border-soft bg-surface-card"
            }`}
          >
            {p.highlight && (
              <span className="mb-3 self-start rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                الأكثر شيوعاً
              </span>
            )}
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="mt-3">
              <span className="text-4xl font-bold">{p.price}</span>
              <span className="text-sm text-muted"> / {p.period}</span>
            </p>
            <p className="mt-2 inline-block self-start rounded-full bg-gold/10 px-3 py-1 text-sm font-semibold text-gold">
              ⚡ {p.credits}
            </p>
            <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-accent">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={p.cta.href}
              className={`mt-8 block w-full rounded-xl py-3 text-center font-semibold transition-colors ${
                p.highlight
                  ? "bg-primary text-white hover:bg-primary-strong"
                  : "border border-border-soft hover:border-primary"
              }`}
            >
              {p.cta.label}
            </Link>
          </div>
        ))}
      </div>

      {/* جدول التكلفة — من نفس المصدر الذي يخصم به الخادم فعلياً */}
      <div className="mx-auto mt-14 max-w-2xl">
        <h2 className="text-center text-xl font-bold">كم تكلف كل عملية؟</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-border-soft">
          {COST_LABELS.map((c, i) => (
            <div
              key={c.key}
              className={`flex items-center justify-between px-5 py-3 text-sm ${
                i % 2 ? "" : "bg-surface-card"
              }`}
            >
              <span>
                {c.icon} {c.label}
              </span>
              <span className="font-bold text-gold">⚡ {CREDIT_COSTS[c.key]}</span>
            </div>
          ))}
          <div className="flex items-center justify-between bg-primary/5 px-5 py-3 text-sm">
            <span>✨ المساعدات الذكية كلها</span>
            <span className="font-bold text-accent">مجاناً</span>
          </div>
        </div>
        <p className="mt-3 text-center text-xs leading-relaxed text-muted">
          الزوار غير المسجلين يجربون ضمن حدود يومية دون نقاط — سجّل مجاناً لرصيد شهري كامل
          ومكتبة تحفظ أعمالك.
        </p>
      </div>
    </div>
  );
}
