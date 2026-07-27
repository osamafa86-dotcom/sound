/**
 * خطط الدفع وحزم النقاط — مصدر الحقيقة الواحد للأسعار.
 *
 * الأسعار افتراضية معقولة وقابلة للتغيير من متغيرات البيئة دون نشر جديد،
 * والاشتراك يرفع الباقة الشهرية بينما الحزم تضيف نقاطاً فورية فوقها —
 * فيخدم النظام المشترك المنتظم وصاحب الحاجة الموسمية معاً.
 */

function envUsd(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export type PaidPlanId = "creator" | "studio";

export type PaidPlan = {
  id: PaidPlanId;
  name: string;
  usd: number;
  /** الباقة الشهرية بالنقاط التي يجددها الاشتراك */
  monthlyCredits: number;
};

export const PAID_PLANS: Record<PaidPlanId, PaidPlan> = {
  creator: {
    id: "creator",
    name: "المبدع",
    usd: envUsd("PLAN_CREATOR_USD", 9),
    monthlyCredits: 5000,
  },
  studio: {
    id: "studio",
    name: "الاستوديو",
    usd: envUsd("PLAN_STUDIO_USD", 29),
    monthlyCredits: 20000,
  },
};

export type CreditPack = {
  id: string;
  name: string;
  credits: number;
  usd: number;
};

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-s", name: "حزمة البداية", credits: 1000, usd: envUsd("PACK_S_USD", 4) },
  { id: "pack-m", name: "حزمة الإنتاج", credits: 5000, usd: envUsd("PACK_M_USD", 15) },
  { id: "pack-l", name: "حزمة الاستوديو", credits: 20000, usd: envUsd("PACK_L_USD", 49) },
];

export function getPlan(id: string): PaidPlan | null {
  return id === "creator" || id === "studio" ? PAID_PLANS[id] : null;
}

export function getPack(id: string): CreditPack | null {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}
