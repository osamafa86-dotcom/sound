/**
 * قراءة حالة الحماية من الوسيط (Edge) — Web Crypto فقط وجلب REST مباشر
 * من Supabase مع كاش ٣٠ ثانية لكل خادم، فلا يضيف زمناً يُذكر للطلبات.
 * بلا Supabase مضبوط: الموقع مفتوح (لا يمكن إدامة كلمة سر بلا مخزن).
 */

export type EdgeSecurityState = {
  protectedSite: boolean;
  secret: string;
};

const mem = globalThis as unknown as {
  __secEdge?: { value: EdgeSecurityState; at: number };
};
const CACHE_MS = 30_000;

export async function getEdgeSecurityState(): Promise<EdgeSecurityState> {
  if (mem.__secEdge && Date.now() - mem.__secEdge.at < CACHE_MS) return mem.__secEdge.value;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let state: EdgeSecurityState = { protectedSite: false, secret: "" };
  if (url && key) {
    try {
      const res = await fetch(
        `${url}/rest/v1/platform_settings?key=eq.site_security&select=value`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
      );
      if (res.ok) {
        const rows = (await res.json()) as { value?: { passwordHash?: string; version?: number } }[];
        const v = rows?.[0]?.value;
        if (v && typeof v.passwordHash === "string" && v.passwordHash) {
          state = {
            protectedSite: true,
            secret: `lahn-gate::${typeof v.version === "number" ? v.version : 0}::${v.passwordHash}`,
          };
        }
      }
    } catch {
      // تعذّر القراءة: نسمح بالمرور بدل قفل الموقع كله بعطل عابر
    }
  }
  mem.__secEdge = { value: state, at: Date.now() };
  return state;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEq(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const GATE_TTL_SEC = 60 * 60 * 24 * 30; // يطابق GATE_TOKEN_TTL_SEC في security.ts

export async function verifyGateTokenEdge(
  token: string | undefined,
  secret: string,
  maxAgeSec?: number
): Promise<boolean> {
  if (!token || !secret) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const expStr = token.slice(0, dot);
  const exp = Number(expStr);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(exp) || exp < now) return false;
  // شرط الطزاجة: عمر الرمز منذ إصداره = TTL - (exp - now)
  if (maxAgeSec !== undefined && GATE_TTL_SEC - (exp - now) > maxAgeSec) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = toHex(await crypto.subtle.sign("HMAC", key, enc.encode(expStr)));
  return timingSafeEq(token.slice(dot + 1), sig);
}

/** يمسح كاش الحالة فوراً بعد أي تعديل من نفس الخادم */
export function bustEdgeSecurityCache(): void {
  mem.__secEdge = undefined;
}
