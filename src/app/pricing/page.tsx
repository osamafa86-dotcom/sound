export const metadata = { title: "الأسعار" };

const plans = [
  {
    name: "مجاني",
    price: "0$",
    period: "للتجربة",
    features: ["دقائق TTS محدودة شهرياً", "معاينات أغانٍ قصيرة", "جودة قياسية", "مكتبة أساسية"],
    cta: "ابدأ مجاناً",
    highlight: false,
  },
  {
    name: "المبدع",
    price: "قريباً",
    period: "شهرياً",
    features: ["رصيد شهري وافر من الكريدت", "كل الأصوات واللهجات", "أغانٍ كاملة بجودة عالية", "أولوية في التوليد", "استخدام تجاري"],
    cta: "قريباً",
    highlight: true,
  },
  {
    name: "الاستوديو",
    price: "قريباً",
    period: "شهرياً",
    features: ["كل مزايا المبدع", "حجم استخدام أكبر", "وصول API خاص", "دعم مباشر"],
    cta: "قريباً",
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-center text-3xl font-bold">الأسعار</h1>
      <p className="mx-auto mt-2 max-w-xl text-center text-muted">
        نظام كريدت بسيط: كل توليد يستهلك نقاطاً حسب النوع والمدة والجودة.
        الباقات النهائية تُعلن مع إطلاق نظام الحسابات.
      </p>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`rounded-3xl border p-8 ${
              p.highlight
                ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                : "border-border-soft bg-surface-card"
            }`}
          >
            {p.highlight && (
              <span className="mb-3 inline-block rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                الأكثر شيوعاً
              </span>
            )}
            <h2 className="text-xl font-bold">{p.name}</h2>
            <p className="mt-3">
              <span className="text-4xl font-bold">{p.price}</span>
              <span className="text-sm text-muted"> / {p.period}</span>
            </p>
            <ul className="mt-6 flex flex-col gap-2.5 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="text-accent">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              disabled
              className={`mt-8 w-full cursor-not-allowed rounded-xl py-3 font-semibold opacity-70 ${
                p.highlight ? "bg-primary text-white" : "border border-border-soft"
              }`}
            >
              {p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
