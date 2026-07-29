import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { decryptToken, encryptToken } from "./crypto";
import type { ManagedPage } from "./graph";

/**
 * سجل الصفحات المربوطة — كل صفحة مربوطة بمستخدم مقام الذي ربطها.
 *
 * الجدول بلا سياسات RLS إطلاقاً (مثل song_jobs): لا يصله المتصفح بأي حال،
 * ومفتاح الخدمة وحده يتجاوزها. والرمز داخله مشفّر فوق ذلك.
 * بلا Supabase يعمل مخزن ذاكرة للتطوير المحلي فقط.
 */

const TABLE = "facebook_pages";

export type ConnectedPage = {
  pageId: string;
  name: string;
  category: string | null;
  connectedAt: number;
};

type StoredPage = ConnectedPage & { userId: string; encryptedToken: string };

const store = globalThis as unknown as { __facebookPages?: Map<string, StoredPage> };
const memoryPages = (store.__facebookPages ??= new Map<string, StoredPage>());

const memoryKey = (userId: string, pageId: string) => `${userId}:${pageId}`;

/** يحفظ (أو يحدّث) الصفحات التي وافق المستخدم على ربطها */
export async function savePages(
  userId: string,
  pages: ManagedPage[],
  tokenSecret: string
): Promise<number> {
  if (!pages.length) return 0;

  const admin = getSupabaseAdmin();
  if (admin) {
    const { error } = await admin.from(TABLE).upsert(
      pages.map((page) => ({
        user_id: userId,
        page_id: page.id,
        name: page.name,
        category: page.category,
        access_token: encryptToken(page.accessToken, tokenSecret),
      })),
      { onConflict: "user_id,page_id" }
    );
    if (error) throw new Error(`تعذّر حفظ الصفحات: ${error.message}`);
    return pages.length;
  }

  for (const page of pages) {
    memoryPages.set(memoryKey(userId, page.id), {
      userId,
      pageId: page.id,
      name: page.name,
      category: page.category,
      connectedAt: Date.now(),
      encryptedToken: encryptToken(page.accessToken, tokenSecret),
    });
  }
  return pages.length;
}

/** صفحات المستخدم بلا أي رمز — هذا ما يراه المتصفح */
export async function listPages(userId: string): Promise<ConnectedPage[]> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from(TABLE)
      .select("page_id, name, category, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (error || !data) return [];

    return data.map((row) => ({
      pageId: row.page_id as string,
      name: row.name as string,
      category: (row.category as string | null) ?? null,
      connectedAt: new Date(row.created_at as string).getTime(),
    }));
  }

  return [...memoryPages.values()]
    .filter((page) => page.userId === userId)
    .map(({ pageId, name, category, connectedAt }) => ({ pageId, name, category, connectedAt }));
}

/** رمز صفحة يملكها هذا المستخدم — يعيد null إن لم تكن له */
export async function getPageToken(
  userId: string,
  pageId: string,
  tokenSecret: string
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  if (admin) {
    const { data, error } = await admin
      .from(TABLE)
      .select("access_token")
      .eq("user_id", userId)
      .eq("page_id", pageId)
      .maybeSingle();
    if (error || !data?.access_token) return null;
    return decryptToken(data.access_token as string, tokenSecret);
  }

  const page = memoryPages.get(memoryKey(userId, pageId));
  return page ? decryptToken(page.encryptedToken, tokenSecret) : null;
}

/** فكّ ربط صفحة — يحذف الرمز من عندنا (ولا يلغي الإذن لدى فيسبوك) */
export async function removePage(userId: string, pageId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (admin) {
    await admin.from(TABLE).delete().eq("user_id", userId).eq("page_id", pageId);
    return;
  }
  memoryPages.delete(memoryKey(userId, pageId));
}
