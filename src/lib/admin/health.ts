import { LIMITS, SIGNED_IN_MULTIPLIER } from "@/lib/rateLimit";
import { VOICES } from "@/lib/voices";
import { MAQAMAT } from "@/lib/maqamat";
import { availableVoices } from "@/lib/providers";
import { ROUTE_LABELS, routeCostUsd } from "./aggregate";
import { ownerEmails } from "@/lib/owner";

/**
 * صورة كاملة عن حالة النظام كما هو مضبوط الآن — أي محرّك يعمل، وأي ميزة
 * معطّلة لغياب مفتاح، وأي نموذج مستخدم، وما هي الحدود السارية.
 *
 * مبدأ أمني ثابت: لا تُعاد قيمة أي مفتاح أبداً — بوجوده فقط (true/false).
 */

const has = (name: string) => !!process.env[name]?.trim();

export type IntegrationStatus = {
  id: string;
  name: string;
  /** ما الذي يتوقف عند غياب هذا التكامل */
  powers: string[];
  configured: boolean;
  /** المتغيرات المطلوبة لتفعيله */
  envVars: string[];
  /** النموذج المستخدم فعلياً عند التفعيل */
  model?: string;
  /** درجة الأهمية: أساسي يعطّل المنتج، وإضافي يقلّص ميزة */
  critical: boolean;
};

export function integrations(): IntegrationStatus[] {
  return [
    {
      id: "elevenlabs",
      name: "ElevenLabs",
      powers: ["النص إلى صوت", "التفريغ النصي", "تحويل صوت إلى صوت", "استنساخ وتصميم الأصوات", "ذاكرة النطق", "الاستوديو الدرامي", "الكتب الصوتية", "Eleven Music"],
      configured: has("ELEVENLABS_API_KEY"),
      envVars: ["ELEVENLABS_API_KEY"],
      model: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
      critical: true,
    },
    {
      id: "gemini",
      name: "Google Gemini + Lyria",
      powers: ["توليد الأغاني (Lyria 3 Pro)", "مساعد الكلمات البديل", "الموسيقى من صورة", "سيناريو البودكاست", "تحليل الدراما"],
      configured: has("GEMINI_API_KEY"),
      envVars: ["GEMINI_API_KEY"],
      model: `${process.env.GEMINI_MODEL ?? "gemini-3.6-flash"} + ${process.env.LYRIA_MODEL ?? "lyria-3-pro-preview"}`,
      critical: true,
    },
    {
      id: "anthropic",
      name: "Anthropic Claude",
      powers: ["مساعد الكلمات والمقامات (الأولوية الأولى)", "تحسين النص"],
      configured: has("ANTHROPIC_API_KEY"),
      envVars: ["ANTHROPIC_API_KEY"],
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
      critical: false,
    },
    {
      id: "azure",
      name: "Azure Speech",
      powers: ["أصوات Neural للهجات العربية"],
      configured: has("AZURE_SPEECH_KEY") && has("AZURE_SPEECH_REGION"),
      envVars: ["AZURE_SPEECH_KEY", "AZURE_SPEECH_REGION"],
      critical: false,
    },
    {
      id: "facebook",
      name: "Meta (فيسبوك)",
      powers: ["ربط صفحات فيسبوك", "نشر الأعمال على الصفحات"],
      configured: has("FACEBOOK_APP_ID") && has("FACEBOOK_APP_SECRET"),
      envVars: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
      model: process.env.FACEBOOK_GRAPH_VERSION ?? "v25.0",
      critical: false,
    },
    {
      id: "supabase",
      name: "Supabase (حسابات ومكتبة)",
      powers: ["تسجيل الدخول", "المكتبة السحابية", "التقييمات"],
      configured: has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
      critical: false,
    },
    {
      id: "supabase-service",
      name: "Supabase (مفتاح الخدمة)",
      powers: ["مهام الأغاني الدائمة", "حدود الاستهلاك الذرّية", "سجل الاستهلاك", "لوحة المالك"],
      configured: has("SUPABASE_SERVICE_ROLE_KEY"),
      envVars: ["SUPABASE_SERVICE_ROLE_KEY"],
      critical: false,
    },
  ];
}

export type FeatureStatus = {
  id: string;
  name: string;
  path: string;
  /** live = بمحرك حقيقي، mock = وضع تجريبي، off = معطّل */
  state: "live" | "mock" | "off";
  note: string;
};

/** حالة كل ميزة في الموقع بناءً على المفاتيح المتوفرة */
export function features(forceMock = false): FeatureStatus[] {
  const eleven = has("ELEVENLABS_API_KEY");
  const gemini = has("GEMINI_API_KEY");
  const claude = has("ANTHROPIC_API_KEY");
  const supabase = has("NEXT_PUBLIC_SUPABASE_URL") && has("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const service = has("SUPABASE_SERVICE_ROLE_KEY");
  const facebook = has("FACEBOOK_APP_ID") && has("FACEBOOK_APP_SECRET");

  const state = (live: boolean, fallbackMock = true): FeatureStatus["state"] =>
    forceMock ? "mock" : live ? "live" : fallbackMock ? "mock" : "off";

  return [
    { id: "tts", name: "استوديو النص إلى صوت", path: "/tts", state: state(eleven), note: eleven ? "ElevenLabs" : "وضع تجريبي — أضف ELEVENLABS_API_KEY" },
    { id: "songs", name: "استوديو الأغاني والمقامات", path: "/songs", state: state(gemini || eleven), note: gemini ? "Lyria 3 Pro مع رجوع لـ Eleven Music" : eleven ? "Eleven Music" : "وضع تجريبي — سلّم المقام فقط" },
    { id: "lyrics", name: "مساعد الكلمات والمقامات", path: "/songs", state: state(claude || gemini), note: claude ? "Claude ثم Gemini" : gemini ? "Gemini" : "وضع تجريبي" },
    { id: "voice", name: "معمل الصوت (تفريغ/تحويل/استنساخ)", path: "/voice", state: state(eleven, false), note: eleven ? "Scribe + Speech-to-Speech" : "معطّل بلا ELEVENLABS_API_KEY" },
    { id: "drama", name: "الاستوديو الدرامي", path: "/drama", state: state(gemini && eleven, false), note: gemini && eleven ? "تحليل بـ Gemini وإلقاء بـ ElevenLabs" : "يحتاج مفتاحي Gemini وElevenLabs" },
    { id: "podcast", name: "البودكاست الذكي", path: "/podcast", state: state(gemini && eleven, false), note: gemini && eleven ? "سيناريو وإلقاء متعدد الأصوات" : "يحتاج مفتاحي Gemini وElevenLabs" },
    { id: "audiobook", name: "استوديو الكتب الصوتية", path: "/audiobook", state: state(eleven), note: eleven ? "فهرسة محلية وإلقاء بـ ElevenLabs" : "الفهرسة تعمل، والإلقاء بوضع تجريبي" },
    { id: "library", name: "المكتبة السحابية والحسابات", path: "/library", state: supabase ? "live" : "off", note: supabase ? "Supabase Auth + Storage" : "مكتبة محلية في المتصفح فقط" },
    { id: "share", name: "المشاركة برابط عام", path: "/library", state: service ? "live" : "off", note: service ? "صفحات /s/… بوسوم OG" : "تحتاج SUPABASE_SERVICE_ROLE_KEY" },
    { id: "facebook", name: "النشر على فيسبوك", path: "/library", state: facebook && service ? "live" : "off", note: facebook ? (service ? "ربط الصفحات ونشر الروابط" : "يحتاج SUPABASE_SERVICE_ROLE_KEY أيضاً") : "يحتاج FACEBOOK_APP_ID وFACEBOOK_APP_SECRET" },
    { id: "jobs", name: "المهام الطويلة الدائمة", path: "/songs", state: service ? "live" : "mock", note: service ? "جدول song_jobs في Supabase" : "ذاكرة الخادم (تُفقد بين النسخ)" },
    { id: "limits", name: "حدود الاستهلاك الذرّية", path: "-", state: service ? "live" : "mock", note: service ? "دالة consume_rate_limit" : "عدّاد في ذاكرة النسخة" },
    { id: "pricing", name: "الكريدت والدفع", path: "/pricing", state: "off", note: "المرحلة 6 — لم تُنفّذ بعد" },
  ];
}

/** بيئة التشغيل — يفيد المالك في معرفة أي نشرة تعمل الآن */
export function runtimeInfo() {
  return {
    nodeVersion: process.version,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    region: process.env.VERCEL_REGION ?? null,
    deploymentUrl: process.env.VERCEL_URL ?? null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.slice(0, 120) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    startedAt: new Date().toISOString(),
  };
}

/** كتالوجات المحتوى الثابتة — أرقام تُطمئن المالك أن المكتبة كاملة */
export function catalogs() {
  const available = availableVoices();
  const byDialect: Record<string, number> = {};
  for (const v of VOICES) byDialect[v.dialect] = (byDialect[v.dialect] ?? 0) + 1;

  return {
    voices: {
      total: VOICES.length,
      available: available.length,
      elevenlabs: VOICES.filter((v) => v.provider === "elevenlabs").length,
      azure: VOICES.filter((v) => v.provider === "azure").length,
      male: VOICES.filter((v) => v.gender === "male").length,
      female: VOICES.filter((v) => v.gender === "female").length,
      dialects: Object.keys(byDialect).length,
      byDialect,
    },
    maqamat: MAQAMAT.map((m) => ({ id: m.id, name: m.name, mood: m.mood })),
  };
}

/** جدول الحدود السارية الآن مع كلفتها التقديرية */
export function limitsTable() {
  return Object.entries(LIMITS).map(([scope, rule]) => ({
    scope,
    label: ROUTE_LABELS[scope] ?? scope,
    perVisitor: rule.perVisitor,
    perSignedIn: rule.perVisitor * SIGNED_IN_MULTIPLIER,
    global: rule.global,
    windowSec: rule.windowSec,
    estimatedUsdPerEvent: routeCostUsd(scope),
  }));
}

/** إعداد المالك نفسه — عدد المالكين بلا كشف بُرُدهم كاملة */
export function ownerInfo() {
  const emails = ownerEmails();
  return {
    configured: emails.length > 0,
    count: emails.length,
    /** البريد مقنّع: أول حرفين ثم النطاق */
    masked: emails.map((e) => {
      const [name, domain] = e.split("@");
      return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain ?? ""}`;
    }),
  };
}
