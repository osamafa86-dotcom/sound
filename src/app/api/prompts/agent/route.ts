import { NextRequest, NextResponse } from "next/server";
import { agentDraft, agentPort, agentRefine, agentReview } from "@/lib/promptAgent";
import { PROMPT_TYPES } from "@/lib/promptSmith";
import { topPromptExemplars } from "@/lib/promptLibrary";
import { checkLimit, limitResponse } from "@/lib/rateLimit";
import { getUserFromRequest } from "@/lib/serverAuth";
import { logUsage } from "@/lib/usage";
import type { AgentIssue } from "@/lib/promptAgent";
import type { CraftedPrompt } from "@/lib/promptSmith";

export const maxDuration = 90;

/**
 * وكيل البرومبتات — العميل يقود الحلقة خطوة خطوة فتظهر الجولات حية:
 * draft (مسودة بافتراضات) / review (حكم ناقد بدرجات وثغرات) /
 * refine (تحسين بالثغرات) / port (نقل للهجات منصات أخرى)
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "وكيل البرومبتات يتطلب مفتاح Gemini" }, { status: 503 });
  }

  const user = await getUserFromRequest(req);
  const verdict = await checkLimit(req, "promptAgent", user?.id ?? null);
  if (!verdict.allowed) return limitResponse(verdict);

  const body = await req.json().catch(() => null);
  const action = body?.action as string;
  const typeId = typeof body?.typeId === "string" ? body.typeId : "";
  const type = PROMPT_TYPES.find((t) => t.id === typeId);
  if (!type) return NextResponse.json({ error: "اختر نوع البرومبت" }, { status: 400 });

  const brief = typeof body?.brief === "string" ? body.brief.trim().slice(0, 2000) : "";
  const platform =
    typeof body?.platform === "string" && type.platforms.includes(body.platform)
      ? body.platform
      : undefined;

  try {
    switch (action) {
      case "draft": {
        if (!brief) return NextResponse.json({ error: "صف ما تريد أولاً" }, { status: 400 });
        // أنجح برومبتات هذا النوع من ذاكرة المستخدمين تُحقن أمثلةً
        const exemplars = await topPromptExemplars(typeId, 2);
        const draft = await agentDraft(apiKey, typeId, brief, platform, exemplars);
        await logUsage("promptAgent", user?.id ?? null);
        return NextResponse.json(draft);
      }
      case "review": {
        const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 6000) : "";
        if (!brief || !prompt) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
        const review = await agentReview(apiKey, typeId, brief, prompt, platform);
        return NextResponse.json(review);
      }
      case "refine": {
        const current = body?.current as CraftedPrompt;
        const issues = (Array.isArray(body?.issues) ? body.issues : []) as AgentIssue[];
        if (!brief || !current?.prompt || !issues.length) {
          return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
        }
        const refined = await agentRefine(apiKey, typeId, brief, current, issues.slice(0, 6), platform);
        return NextResponse.json(refined);
      }
      case "port": {
        const prompt = typeof body?.prompt === "string" ? body.prompt.slice(0, 6000) : "";
        if (!prompt) return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
        const targets = type.platforms.filter((p) => p !== platform).slice(0, 4);
        const variants = await agentPort(apiKey, typeId, prompt, targets);
        await logUsage("promptAgent", user?.id ?? null);
        return NextResponse.json({ variants });
      }
      default:
        return NextResponse.json({ error: "إجراء غير معروف" }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّرت العملية";
    return NextResponse.json(
      { error: msg.startsWith("Gemini") ? "تعذّرت العملية — حاول مجدداً" : msg },
      { status: 502 }
    );
  }
}
