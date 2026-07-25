import { getSupabase } from "./supabase";
import { localList, localRemove, localSave, type LocalItem } from "./localLibrary";

/**
 * طبقة المكتبة الموحّدة: تحفظ وتقرأ من Supabase (تخزين + قاعدة بيانات بحماية RLS)
 * عندما يكون المستخدم مسجلاً، وإلا تستخدم المكتبة المحلية في المتصفح.
 */

export type LibraryItem = {
  id: string;
  kind: "tts" | "song" | "recording";
  title: string;
  details: string;
  mimeType: string;
  createdAt: number;
  source: "cloud" | "local";
  /** رابط تشغيل جاهز: Object URL محلي أو رابط موقّع من التخزين السحابي */
  url: string;
};

export type SaveInput = {
  kind: "tts" | "song" | "recording";
  title: string;
  details: string;
  blob: Blob;
  mimeType: string;
};

const BUCKET = "audio";
const TABLE = "generations";

type GenerationRow = {
  id: string;
  kind: "tts" | "song" | "recording";
  title: string;
  details: string | null;
  mime_type: string;
  storage_path: string;
  created_at: string;
};

async function currentUser() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function saveToLibrary(input: SaveInput): Promise<{ source: "cloud" | "local" }> {
  const supabase = getSupabase();
  const user = await currentUser();

  if (supabase && user) {
    const id = crypto.randomUUID();
    const ext = input.mimeType === "audio/mpeg" ? "mp3" : "wav";
    const path = `${user.id}/${id}.${ext}`;

    const upload = await supabase.storage.from(BUCKET).upload(path, input.blob, {
      contentType: input.mimeType,
    });
    if (upload.error) {
      throw new Error(`تعذّر رفع الملف: ${upload.error.message}`);
    }

    const insert = await supabase.from(TABLE).insert({
      id,
      user_id: user.id,
      kind: input.kind,
      title: input.title,
      details: input.details,
      mime_type: input.mimeType,
      storage_path: path,
    });
    if (insert.error) {
      // تنظيف الملف المرفوع كي لا يبقى يتيماً
      await supabase.storage.from(BUCKET).remove([path]);
      throw new Error(`تعذّر الحفظ: ${insert.error.message}`);
    }
    return { source: "cloud" };
  }

  await localSave({
    id: crypto.randomUUID(),
    kind: input.kind,
    title: input.title,
    details: input.details,
    mimeType: input.mimeType,
    createdAt: Date.now(),
    blob: input.blob,
  });
  return { source: "local" };
}

export async function listLibrary(): Promise<LibraryItem[]> {
  const items: LibraryItem[] = [];
  const supabase = getSupabase();
  const user = await currentUser();

  if (supabase && user) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      throw new Error(`تعذّر تحميل المكتبة: ${error.message}`);
    }
    const rows = (data ?? []) as GenerationRow[];
    if (rows.length) {
      const signed = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(rows.map((r) => r.storage_path), 3600);
      const urlByPath = new Map(
        (signed.data ?? []).map((s) => [s.path, s.signedUrl] as const)
      );
      items.push(
        ...rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          details: row.details ?? "",
          mimeType: row.mime_type,
          createdAt: new Date(row.created_at).getTime(),
          source: "cloud" as const,
          url: urlByPath.get(row.storage_path) ?? "",
        }))
      );
    }
  }

  const locals = await localList();
  items.push(
    ...locals.map((l: LocalItem) => ({
      id: l.id,
      kind: l.kind,
      title: l.title,
      details: l.details,
      mimeType: l.mimeType,
      createdAt: l.createdAt,
      source: "local" as const,
      url: URL.createObjectURL(l.blob),
    }))
  );

  return items.sort((a, b) => b.createdAt - a.createdAt);
}

export async function removeFromLibrary(item: LibraryItem): Promise<void> {
  if (item.source === "local") {
    await localRemove(item.id);
    return;
  }
  const supabase = getSupabase();
  if (!supabase) return;
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", item.id)
    .select("storage_path");
  if (error) {
    throw new Error(`تعذّر الحذف: ${error.message}`);
  }
  const paths = (data ?? []).map((r: { storage_path: string }) => r.storage_path);
  if (paths.length) {
    await supabase.storage.from(BUCKET).remove(paths);
  }
}
