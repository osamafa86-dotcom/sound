import { NextRequest, NextResponse } from "next/server";
import { LIVE_CAP_GUEST_SEC, LIVE_CAP_MEMBER_SEC, LIVE_MODEL } from "@/lib/liveMaqam";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";

export const maxDuration = 30;

/**
 * رمز مؤقت لجلسة معاينة المقام الحية (Lyria RealTime):
 * المتصفح يتصل بمقبس Google مباشرة — لا يجوز كشف مفتاح Gemini له،
 * فنسكّ له رمزاً مؤقتاً وحيد الاستخدام قصير العمر (v1alpha authTokens)
 * مقيداً بنموذج الجلسة الحية، خلف حدود الاستهلاك ورصيد الأعضاء.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "liveJam", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "المعاينة الحية تتطلب مفتاح Gemini — غير مضبوط في هذه البيئة" },
      { status: 503 }
    );
  }

  const expireTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const endpoint = "https://generativelanguage.googleapis.com/v1alpha/authTokens";
  const headers = { "Content-Type": "application/json", "x-goog-api-key": apiKey };

  // محاولة أولى بقيد النموذج (الأضيق أماناً)، ثم بلا قيود إن رفض الشكل
  const attempts: Record<string, unknown>[] = [
    { uses: 1, expireTime, liveConnectConstraints: { model: LIVE_MODEL } },
    { uses: 1, expireTime },
  ];

  for (const body of attempts) {
    try {
      const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
      if (!res.ok) continue;
      const data = (await res.json()) as { name?: string };
      if (!data.name) continue;
      await logUsage("liveJam", user?.id ?? null);
      return NextResponse.json({
        token: data.name,
        model: LIVE_MODEL,
        expiresAt: expireTime,
        capSec: user ? LIVE_CAP_MEMBER_SEC : LIVE_CAP_GUEST_SEC,
      });
    } catch (e) {
      console.error("live token mint attempt failed:", e);
    }
  }

  return NextResponse.json(
    { error: "تعذّر فتح جلسة المعاينة الحية — جرّب بعد قليل" },
    { status: 502 }
  );
}
