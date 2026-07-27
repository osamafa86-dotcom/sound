import { getSupabaseAdmin } from "./supabaseAdmin";
import type { CraftedPrompt } from "./promptSmith";

/**
 * ذاكرة البرومبتات — كل صياغة تُحفظ بنتيجتها وتقييم صاحبها:
 * «⭐ اشتغل ممتاز» يجعلها مثالاً يُحقن في صياغات النوع القادمة للجميع،
 * فيتحسن المهندس من تجارب المستخدمين الفعلية لا من افتراضاته.
 */

export type PromptCraftRow = {
  id: string;
  type_id: string;
  platform: string | null;
  brief: string;
  result: CraftedPrompt;
  score: number | null;
  feedback: number | null;
  created_at: string;
};

export async function savePromptCraft(opts: {
  userId: string;
  typeId: string;
  platform?: string;
  brief: string;
  result: CraftedPrompt;
  score?: number;
}): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("prompt_crafts")
    .insert({
      user_id: opts.userId,
      type_id: opts.typeId,
      platform: opts.platform ?? null,
      brief: opts.brief.slice(0, 2000),
      result: opts.result,
      score: opts.score ?? null,
    })
    .select("id")
    .single();
  if (error) {
    console.error("prompt craft save failed:", error.message);
    return null;
  }
  return data.id as string;
}

export async function listPromptCrafts(userId: string, limit = 10): Promise<PromptCraftRow[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("prompt_crafts")
    .select("id, type_id, platform, brief, result, score, feedback, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return error || !data ? [] : (data as PromptCraftRow[]);
}

export async function setPromptFeedback(
  userId: string,
  id: string,
  feedback: 1 | -1
): Promise<boolean> {
  const admin = getSupabaseAdmin();
  if (!admin) return false;
  const { error } = await admin
    .from("prompt_crafts")
    .update({ feedback })
    .eq("id", id)
    .eq("user_id", userId);
  return !error;
}

/** أنجح برومبتات النوع (⭐ من أصحابها) — أمثلة تُحقن في الصياغات القادمة */
export async function topPromptExemplars(typeId: string, max = 2): Promise<string[]> {
  if (process.env.BRAIN_DISABLED === "1") return [];
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("prompt_crafts")
    .select("result")
    .eq("type_id", typeId)
    .eq("feedback", 1)
    .order("created_at", { ascending: false })
    .limit(max);
  if (error || !data) return [];
  return data
    .map((r) => (r.result as CraftedPrompt | null)?.prompt)
    .filter((p): p is string => typeof p === "string" && p.length > 0);
}
