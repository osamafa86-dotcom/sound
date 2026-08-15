/**
 * الحماية الذاتية للموقع — كلمة سر ومفاتيح بصمة/وجه (Passkeys) يديرها
 * صاحب الموقع من صفحة /security بلا أي إعادة نشر.
 *
 * التخزين: صف "site_security" في جدول platform_settings القائم (لا DDL).
 * بلا Supabase: ذاكرة العملية (يصلح للتطوير، لا يدوم على Serverless).
 * جلسة الدخول: كوكي HMAC سرّه مشتق من نسخة كلمة السر — أي تغيير أو إزالة
 * لكلمة السر يبطل كل الجلسات القديمة تلقائياً.
 */
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual as tse } from "node:crypto";
import { getSupabaseAdmin } from "./supabaseAdmin";

export const SECURITY_KEY = "site_security";
export const GATE_COOKIE = "mqaam_gate";
export const GATE_TOKEN_TTL_SEC = 60 * 60 * 24 * 30;
export const CHALLENGE_COOKIE = "mqaam_chal";

export type StoredPasskey = {
  id: string;
  publicKey: string; // base64
  counter: number;
  transports?: string[];
  label: string;
  createdAt: string;
};

export type SecurityConfig = {
  /** null = الموقع مفتوح بلا كلمة سر */
  passwordHash: string | null;
  salt: string;
  /** يرتفع مع كل تعيين/تغيير/إزالة — يبطل الجلسات القديمة */
  version: number;
  passkeys: StoredPasskey[];
};

const DEFAULTS: SecurityConfig = { passwordHash: null, salt: "", version: 0, passkeys: [] };

const mem = globalThis as unknown as {
  __secCfg?: { value: SecurityConfig; at: number };
  __secLocal?: SecurityConfig;
};
const CACHE_MS = 10_000;

export function normalizeSecurity(raw: unknown): SecurityConfig {
  const v = (raw ?? {}) as Record<string, unknown>;
  return {
    passwordHash: typeof v.passwordHash === "string" ? v.passwordHash : null,
    salt: typeof v.salt === "string" ? v.salt : "",
    version: typeof v.version === "number" ? v.version : 0,
    passkeys: Array.isArray(v.passkeys)
      ? v.passkeys.filter(
          (p): p is StoredPasskey =>
            !!p && typeof (p as StoredPasskey).id === "string" && typeof (p as StoredPasskey).publicKey === "string"
        )
      : [],
  };
}

export async function readSecurity(fresh = false): Promise<SecurityConfig> {
  if (!fresh && mem.__secCfg && Date.now() - mem.__secCfg.at < CACHE_MS) return mem.__secCfg.value;
  const db = getSupabaseAdmin();
  if (!db) return mem.__secLocal ?? DEFAULTS;
  const { data } = await db.from("platform_settings").select("value").eq("key", SECURITY_KEY).maybeSingle();
  const cfg = normalizeSecurity(data?.value);
  mem.__secCfg = { value: cfg, at: Date.now() };
  return cfg;
}

export async function writeSecurity(cfg: SecurityConfig): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) {
    mem.__secLocal = cfg;
  } else {
    const { error } = await db
      .from("platform_settings")
      .upsert({ key: SECURITY_KEY, value: cfg }, { onConflict: "key" });
    if (error) throw new Error("تعذّر حفظ إعدادات الحماية: " + error.message);
  }
  mem.__secCfg = { value: cfg, at: Date.now() };
}

// ===== مفتاح المالك: يحمي صفحة الحماية نفسها من الزوار =====
/** هل ضُبط مفتاح المالك في البيئة؟ بدونه إدارة الحماية مقفلة للجميع */
export function ownerKeyConfigured(): boolean {
  return !!(process.env.SITE_OWNER_KEY && process.env.SITE_OWNER_KEY.length >= 4);
}

/** مقارنة بزمن ثابت لمفتاح المالك القادم من صفحة الحماية */
export function checkOwnerKey(candidate: string): boolean {
  const key = process.env.SITE_OWNER_KEY ?? "";
  if (!key || key.length < 4) return false;
  const a = Buffer.from(String(candidate));
  const b = Buffer.from(key);
  return a.length === b.length && tse(a, b);
}

// ===== كلمة السر =====
export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 100_000, 32, "sha256").toString("hex");
}

export function checkPassword(candidate: string, cfg: SecurityConfig): boolean {
  if (!cfg.passwordHash) return false;
  const got = Buffer.from(hashPassword(candidate, cfg.salt), "hex");
  const want = Buffer.from(cfg.passwordHash, "hex");
  return got.length === want.length && tse(got, want);
}

export function newSalt(): string {
  return randomBytes(16).toString("hex");
}

// ===== جلسة الدخول =====
export function gateSecret(cfg: SecurityConfig): string {
  return `lahn-gate::${cfg.version}::${cfg.passwordHash ?? "open"}`;
}

export function createGateToken(cfg: SecurityConfig): string {
  const exp = Math.floor(Date.now() / 1000) + GATE_TOKEN_TTL_SEC;
  const sig = createHmac("sha256", gateSecret(cfg)).update(String(exp)).digest("hex");
  return `${exp}.${sig}`;
}

export function verifyGateTokenNode(token: string | undefined, cfg: SecurityConfig): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expStr = token.slice(0, dot);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  const want = createHmac("sha256", gateSecret(cfg)).update(expStr).digest("hex");
  const a = Buffer.from(token.slice(dot + 1));
  const b = Buffer.from(want);
  return a.length === b.length && tse(a, b);
}
