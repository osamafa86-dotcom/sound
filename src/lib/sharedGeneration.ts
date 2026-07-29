import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * قراءة عمل مُشارك برابط عام. تمرّ عبر مفتاح الخدمة لا عبر سياسة RLS عامة:
 * الصفوف والملفات تبقى خاصة تماماً، والخادم وحده يكشف ما عُلّم `is_public`.
 */

export type SharedGeneration = {
  id: string;
  shareId: string;
  kind: string;
  title: string | null;
  content: string | null;
  voiceId: string | null;
  maqamId: string | null;
  provider: string | null;
  audioPath: string | null;
  createdAt: string;
};

export async function getSharedGeneration(shareId: string): Promise<SharedGeneration | null> {
  const admin = getSupabaseAdmin();
  if (!admin || !shareId) return null;

  const { data, error } = await admin
    .from("generations")
    .select("id, share_id, kind, title, content, voice_id, maqam_id, provider, audio_path, created_at, is_public")
    .eq("share_id", shareId)
    .eq("is_public", true)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    shareId: data.share_id as string,
    kind: data.kind as string,
    title: (data.title as string | null) ?? null,
    content: (data.content as string | null) ?? null,
    voiceId: (data.voice_id as string | null) ?? null,
    maqamId: (data.maqam_id as string | null) ?? null,
    provider: (data.provider as string | null) ?? null,
    audioPath: (data.audio_path as string | null) ?? null,
    createdAt: data.created_at as string,
  };
}
