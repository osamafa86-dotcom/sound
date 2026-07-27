import Link from "next/link";

export const metadata = { title: "تم الدفع" };

/** صفحة العودة بعد الدفع — الرصيد يصل عبر الويب هوك خلال لحظات */
export default async function PaySuccess({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const { provider } = await searchParams;
  const crypto = provider === "crypto";

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <span className="text-6xl">🎉</span>
      <h1 className="mt-5 text-3xl font-bold">
        شكراً لك — <span className="text-gradient">تم استلام طلبك!</span>
      </h1>
      <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
        {crypto
          ? "بمجرد تأكيد معاملتك على الشبكة (دقائق عادةً حسب العملة) ستُضاف النقاط لرصيدك تلقائياً."
          : "نقاطك تُضاف لرصيدك خلال لحظات — إن لم تظهر فوراً حدّث صفحة المكتبة بعد دقيقة."}
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/library"
          className="rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-strong"
        >
          ⚡ شاهد رصيدي
        </Link>
        <Link
          href="/tts"
          className="rounded-xl border border-border-soft px-6 py-3 font-semibold hover:border-primary"
        >
          ابدأ الإبداع ←
        </Link>
      </div>
      <p className="mt-6 text-xs text-muted">
        أي مشكلة في وصول الرصيد؟ <Link href="/support" className="underline">راسل الدعم</Link> ومعك
        بريد الدفع نفسه.
      </p>
    </div>
  );
}
