import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * إعدادات المنصة الحيّة — مفاتيح يملكها صاحب النظام ويغيّرها من اللوحة
 * دون إعادة نشر، وتُطبَّق على كل الخوادم خلال ثوانٍ.
 *
 * التخزين: صف واحد في جدول platform_settings. بلا Supabase تبقى القيم
 * الافتراضية (كل شيء يعمل) فلا يتأثر التطوير المحلي.
 */

export const SETTINGS_KEY = "platform";

export type PlatformSettings = {
  /** إيقاف عام: يمنع كل المسارات المكلفة مؤقتاً (صمام أمان المحفظة) */
  maintenance: boolean;
  /** الرسالة التي تظهر للمستخدم أثناء الإيقاف */
  maintenanceMessage: string;
  /** مسارات موقوفة بعينها (أسماء نطاقات الحدود: tts، songs، drama...) */
  disabledRoutes: string[];
  /** إجبار الوضع التجريبي: يعمل الموقع كاملاً بلا أي كلفة على المزوّدين */
  forceMock: boolean;
  /** لافتة تُعرض أعلى الموقع لكل الزوار (فارغة = مخفية) */
  banner: string;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  maintenance: false,
  maintenanceMessage: "المنصة في صيانة قصيرة — سنعود بعد قليل",
  disabledRoutes: [],
  forceMock: false,
  banner: "",
  updatedAt: null,
  updatedBy: null,
};

/** يقرأ قيماً غير موثوقة من قاعدة البيانات ويعيد إعدادات صحيحة دائماً */
export function normalizeSettings(raw: unknown): PlatformSettings {
  const v = (raw ?? {}) as Record<string, unknown>;
  const text = (key: string, fallback: string) =>
    typeof v[key] === "string" ? (v[key] as string).slice(0, 500) : fallback;

  return {
    maintenance: v.maintenance === true,
    maintenanceMessage: text("maintenanceMessage", DEFAULT_SETTINGS.maintenanceMessage),
    disabledRoutes: Array.isArray(v.disabledRoutes)
      ? [...new Set(v.disabledRoutes.filter((r): r is string => typeof r === "string"))]
      : [],
    forceMock: v.forceMock === true,
    banner: text("banner", ""),
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : null,
    updatedBy: typeof v.updatedBy === "string" ? v.updatedBy : null,
  };
}

const CACHE_MS = 15_000;

// globalThis ليصمد المخزن المؤقت أمام إعادة التحميل الساخن في التطوير
const store = globalThis as unknown as {
  __platformSettings?: { value: PlatformSettings; fetchedAt: number };
};

/**
 * لقطة متزامنة من آخر قراءة — لمن لا يستطيع الانتظار (اختيار المزوّد مثلاً).
 * تُحدَّث تلقائياً في بداية كل طلب مكلف عبر checkLimit.
 */
export function settingsSnapshot(): PlatformSettings {
  return store.__platformSettings?.value ?? DEFAULT_SETTINGS;
}

/** الإعدادات الحالية مع تخزين مؤقت قصير — استدعاؤها رخيص */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const cached = store.__platformSettings;
  if (cached && Date.now() - cached.fetchedAt < CACHE_MS) return cached.value;

  const admin = getSupabaseAdmin();
  if (!admin) {
    store.__platformSettings = { value: DEFAULT_SETTINGS, fetchedAt: Date.now() };
    return DEFAULT_SETTINGS;
  }

  const { data, error } = await admin
    .from("platform_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    // الجدول غير منشأ بعد أو عطل مؤقت: نُبقي المنصة تعمل بالقيم الافتراضية
    console.error("platform settings read failed:", error.message);
    const value = cached?.value ?? DEFAULT_SETTINGS;
    store.__platformSettings = { value, fetchedAt: Date.now() };
    return value;
  }

  const value = normalizeSettings(data?.value);
  store.__platformSettings = { value, fetchedAt: Date.now() };
  return value;
}

/** حفظ إعدادات جديدة من اللوحة — يُحدّث المخزن المؤقت فوراً */
export async function savePlatformSettings(
  patch: Partial<PlatformSettings>,
  actorEmail: string
): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next = normalizeSettings({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  });

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin
      .from("platform_settings")
      .upsert({ key: SETTINGS_KEY, value: next, updated_at: next.updatedAt });
    if (error) throw new Error(`تعذّر حفظ الإعدادات: ${error.message}`);
  }

  store.__platformSettings = { value: next, fetchedAt: Date.now() };
  return next;
}

export type GateVerdict = { blocked: boolean; message: string };

/** هل المسار موقوف الآن بأمر المالك؟ */
export function gateFor(settings: PlatformSettings, scope: string): GateVerdict {
  if (settings.maintenance) {
    return { blocked: true, message: settings.maintenanceMessage || DEFAULT_SETTINGS.maintenanceMessage };
  }
  if (settings.disabledRoutes.includes(scope)) {
    return { blocked: true, message: "هذه الخدمة موقوفة مؤقتاً من إدارة المنصة" };
  }
  return { blocked: false, message: "" };
}
