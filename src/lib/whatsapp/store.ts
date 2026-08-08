import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/**
 * صندوق رسائل واتساب.
 *
 * Meta لا تحفظ لك شيئاً: الرسالة تصل مرة واحدة إلى الـ webhook ثم تختفي.
 * فمن لا يخزّنها يفقدها. مع Supabase تُحفظ دائماً؛ وبدونها يعمل مخزن ذاكرة
 * يكفي للتجربة على خادم واحد (نسخ Vercel لا تتشارك الذاكرة).
 */

const TABLE = "whatsapp_messages";

export type StoredMessage = {
  waId: string;
  contact: string;
  name: string | null;
  direction: "in" | "out";
  type: string;
  text: string | null;
  mediaId: string | null;
  createdAt: string;
};

const store = globalThis as unknown as { __waMessages?: StoredMessage[] };
const memory = (store.__waMessages ??= []);

export async function saveMessage(msg: StoredMessage): Promise<void> {
  const admin = getSupabaseAdmin();
  if (admin) {
    // معرّف واتساب فريد: إعادة إرسال Meta للحمولة نفسها لا تُنتج نسخة ثانية
    const { error } = await admin.from(TABLE).upsert(
      {
        wa_id: msg.waId,
        contact: msg.contact,
        name: msg.name,
        direction: msg.direction,
        type: msg.type,
        text: msg.text,
        media_id: msg.mediaId,
        created_at: msg.createdAt,
      },
      { onConflict: "wa_id", ignoreDuplicates: true }
    );
    if (error) console.error("whatsapp save failed:", error.message);
    return;
  }

  if (!memory.some((m) => m.waId === msg.waId)) {
    memory.push(msg);
    if (memory.length > 2000) memory.splice(0, memory.length - 2000);
  }
}

export type Conversation = {
  contact: string;
  name: string | null;
  lastText: string | null;
  lastAt: string;
  count: number;
};

/** المحادثات مرتّبة بالأحدث — ما يظهر في يمين الصندوق */
export async function listConversations(): Promise<Conversation[]> {
  const rows = await recentRows(1000);
  const byContact = new Map<string, Conversation>();

  for (const m of rows) {
    const prev = byContact.get(m.contact);
    if (!prev) {
      byContact.set(m.contact, {
        contact: m.contact,
        name: m.name,
        lastText: m.text,
        lastAt: m.createdAt,
        count: 1,
      });
    } else {
      prev.count++;
      prev.name = prev.name ?? m.name;
      if (new Date(m.createdAt) > new Date(prev.lastAt)) {
        prev.lastAt = m.createdAt;
        prev.lastText = m.text;
      }
    }
  }

  return [...byContact.values()].sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
  );
}

/** رسائل محادثة واحدة بترتيبها الزمني */
export async function listMessages(contact: string): Promise<StoredMessage[]> {
  const rows = await recentRows(2000);
  return rows
    .filter((m) => m.contact === contact)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

async function recentRows(limit: number): Promise<StoredMessage[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [...memory];

  const { data, error } = await admin
    .from(TABLE)
    .select("wa_id, contact, name, direction, type, text, media_id, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [...memory];

  return data.map((r) => ({
    waId: r.wa_id as string,
    contact: r.contact as string,
    name: (r.name as string | null) ?? null,
    direction: (r.direction as "in" | "out") ?? "in",
    type: (r.type as string) ?? "text",
    text: (r.text as string | null) ?? null,
    mediaId: (r.media_id as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}
