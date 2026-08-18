import { getSupabaseAdmin } from "./supabaseAdmin";
import type { LimitScope } from "./rateLimit";

/**
 * نظام الرصيد — عملة المنصة الموحدة.
 *
 * كل عملية توليد تخصم نقاطاً حسب كلفتها الفعلية لدى المزوّدين،
 * والمسجل يحصل على باقة شهرية مجانية تتجدد تلقائياً مع أول توليد
 * في الشهر الجديد (دالة SQL ذرية — لا سباقات بين نسخ Serverless).
 *
 * الزوار غير المسجلين لا يخضعون للرصيد — تحميهم حدود الاستهلاك وحدها،
 * فيبقى تجريب المنصة مفتوحاً والرصيد ميزةً للحساب لا عائقاً أمامه.
 */

/** الباقة الشهرية المجانية بالنقاط — قابلة للرفع من متغير البيئة */
export const FREE_MONTHLY_CREDITS = (() => {
  const v = Number(process.env.FREE_MONTHLY_CREDITS);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 500;
})();

/**
 * تكلفة كل مسار بالنقاط — تعكس الكلفة النسبية الفعلية لدى المحركات.
 * المسارات الغائبة هنا مجانية (مساعدات نصية خفيفة أو إشارات داخلية).
 */
export const CREDIT_COSTS: Partial<Record<LimitScope, number>> = {
  tts: 2,
  songs: 25,
  drama: 15,
  stt: 3,
  sts: 5,
  isolate: 5,
  voiceClone: 40,
  voiceDesign: 15,
  cover: 5,
  promptTest: 5,
  aiText: 1,
  aiImage: 6,
  // انخفضت مع اعتماد Hailuo محركاً للفيديو (أرخص بكثير من Veo)
  aiVideo: 20,
  // جلسة معاينة مقام حية (Lyria RealTime) — بث قصير مقيد زمنياً
  liveJam: 3,
  // مؤثر صوتي — توليدة قصيرة من محرك المؤثرات
  sfx: 2,
  // الدبلجة — أثقل العمليات لدى المزوّد (تُحاسَب بدقائق المصدر)
  dub: 30,
};

export type CreditVerdict = {
  allowed: boolean;
  /** الرصيد المتبقي بعد الخصم — undefined عندما لا خصم */
  balance?: number;
  cost: number;
};

/** مفتاح طوارئ يوقف الخصم كلياً دون نشر جديد */
const creditsDisabled = () => process.env.CREDITS_DISABLED === "1";

/**
 * خصم كلفة مسار من رصيد مستخدم. fail-open عمداً:
 * قاعدة لم تُرحَّل بعد أو خطأ عابر لا يوقف المنتج — يسمح مع التسجيل.
 */
export async function consumeCredits(userId: string, scope: LimitScope): Promise<CreditVerdict> {
  const cost = CREDIT_COSTS[scope] ?? 0;
  if (!cost || creditsDisabled()) return { allowed: true, cost };

  const admin = getSupabaseAdmin();
  if (!admin) return { allowed: true, cost };

  const { data, error } = await admin.rpc("consume_credits", {
    p_user_id: userId,
    p_cost: cost,
    p_monthly: FREE_MONTHLY_CREDITS,
  });

  if (error) {
    console.error("consume_credits RPC failed:", error.message);
    return { allowed: true, cost };
  }

  const balance = Number(data);
  if (balance === -1) return { allowed: false, cost };
  return { allowed: true, balance, cost };
}

/**
 * استرداد كلفة مسار بعد تعذّر تسليم قيمته الفعلية — عدالة العملة:
 * لا دفع مقابل فشل أو ناتج تجريبي. نمط القراءة ثم التحديث يكفي هنا
 * (كما في منح الدفع): الاسترداد نادر وأسوأ سباقاته نقاط زائدة لصالح المستخدم.
 */
export async function refundCredits(userId: string, scope: LimitScope): Promise<void> {
  const cost = CREDIT_COSTS[scope] ?? 0;
  if (!cost || creditsDisabled()) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const { data: profile, error } = await admin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();
  if (error || !profile) return;

  const { error: upErr } = await admin
    .from("profiles")
    .update({ credits: (profile.credits ?? 0) + cost })
    .eq("id", userId);
  if (upErr) console.error("refund_credits failed:", upErr.message);
}

export type CreditProfile = {
  balance: number;
  /** free | creator | studio */
  plan: string;
  /** الباقة الشهرية الفعلية لهذا المستخدم (تعكس اشتراكه المدفوع) */
  monthly: number;
};

/** قراءة رصيد وباقة مستخدم — للعرض في المكتبة وصفحة الأسعار */
export async function getCreditProfile(userId: string): Promise<CreditProfile | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  // أعمدة الباقات تأتي مع ترحيل الدفع — نتراجع للرصيد وحده قبل تشغيله
  const full = await admin
    .from("profiles")
    .select("credits, plan, monthly_credits")
    .eq("id", userId)
    .single();
  if (!full.error && full.data) {
    return {
      balance: full.data.credits,
      plan: full.data.plan ?? "free",
      monthly: full.data.monthly_credits ?? FREE_MONTHLY_CREDITS,
    };
  }

  const basic = await admin.from("profiles").select("credits").eq("id", userId).single();
  if (basic.error || !basic.data) return null;
  return { balance: basic.data.credits, plan: "free", monthly: FREE_MONTHLY_CREDITS };
}
