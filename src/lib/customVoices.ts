import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * سجل الأصوات المستنسخة: جدول custom_voices في Supabase على الإنتاج
 * (كل صوت مربوط بمالكه)، وذاكرة محلية في التطوير بلا تهيئة.
 */

export type CustomVoice = {
  /** معرّف الصوت لدى ElevenLabs */
  id: string;
  userId: string | null;
  name: string;
  createdAt: number;
};

const globalStore = globalThis as unknown as { __customVoices?: Map<string, CustomVoice> };
const memoryVoices = (globalStore.__customVoices ??= new Map<string, CustomVoice>());

const TABLE = "custom_voices";

export async function addCustomVoice(voice: CustomVoice): Promise<void> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.from(TABLE).insert({
      id: voice.id,
      user_id: voice.userId,
      name: voice.name,
    });
    if (error) throw new Error(`تعذّر تسجيل الصوت المستنسخ: ${error.message}`);
    return;
  }
  memoryVoices.set(voice.id, voice);
}

export async function listCustomVoices(userId: string | null): Promise<CustomVoice[]> {
  const admin = getSupabaseAdmin();
  if (admin) {
    if (!userId) return [];
    const { data, error } = await admin
      .from(TABLE)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return [];
    return (data ?? []).map((r) => ({
      id: r.id as string,
      userId: r.user_id as string | null,
      name: r.name as string,
      createdAt: new Date(r.created_at as string).getTime(),
    }));
  }
  // وضع التطوير: كل الأصوات المحلية متاحة
  return [...memoryVoices.values()].sort((a, b) => b.createdAt - a.createdAt);
}

/** جلب صوت مستنسخ مع التحقق من الملكية (على الإنتاج) */
export async function getCustomVoice(id: string, userId: string | null): Promise<CustomVoice | null> {
  const admin = getSupabaseAdmin();
  if (admin) {
    if (!userId) return null;
    const { data } = await admin.from(TABLE).select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!data) return null;
    return {
      id: data.id as string,
      userId: data.user_id as string | null,
      name: data.name as string,
      createdAt: new Date(data.created_at as string).getTime(),
    };
  }
  return memoryVoices.get(id) ?? null;
}
