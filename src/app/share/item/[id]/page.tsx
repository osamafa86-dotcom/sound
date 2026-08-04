import Link from "next/link";
import type { Metadata } from "next";
import ShareActions from "@/components/ShareActions";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { MAQAMAT } from "@/lib/maqamat";
import { VOICES } from "@/lib/voices";

/**
 * صفحة مشاركة عامة لأي عمل نشره صاحبه في المعرض — الرابط الذي يُشارك
 * على مواقع التواصل: وسوم OG للمعاينة الغنية، ومشغل، ودعوة للتجربة.
 * الأعمال غير المنشورة لا تُعرض هنا أبداً (خصوصية أصحابها).
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type SharedItem = {
  id: string;
  kind: "tts" | "song" | "recording" | "image" | "video";
  title: string | null;
  content: string | null;
  voice_id: string | null;
  maqam_id: string | null;
  created_at: string;
  url: string;
};

async function loadItem(id: string): Promise<SharedItem | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const { data } = await admin
    .from("generations")
    .select("id, kind, title, content, voice_id, maqam_id, audio_path, created_at, is_public")
    .eq("id", id)
    .eq("is_public", true)
    .single();
  if (!data?.audio_path) return null;

  // صلاحية أسبوع — كافية لتداول الرابط على مواقع التواصل وتتجدد مع كل زيارة
  const { data: signed } = await admin.storage
    .from("audio")
    .createSignedUrl(data.audio_path, 7 * 24 * 60 * 60);
  if (!signed?.signedUrl) return null;

  return { ...(data as Omit<SharedItem, "url">), url: signed.signedUrl };
}

function describe(item: SharedItem): { icon: string; label: string; cta: string; href: string } {
  if (item.kind === "song") {
    const maqam = MAQAMAT.find((m) => m.id === item.maqam_id);
    return {
      icon: "🎼",
      label: maqam ? `أغنية بمقام ${maqam.name}` : "أغنية مولّدة بالذكاء الاصطناعي",
      cta: "أنشئ أغنيتك الخاصة ←",
      href: "/songs",
    };
  }
  if (item.kind === "image") {
    return { icon: "🖼️", label: "صورة من ذكاء مقام", cta: "جرّب مساحة مقام ←", href: "/studio" };
  }
  if (item.kind === "video") {
    return { icon: "🎬", label: "فيديو من ذكاء مقام", cta: "جرّب مساحة مقام ←", href: "/studio" };
  }
  const voice = VOICES.find((v) => v.id === item.voice_id);
  return {
    icon: "🎙️",
    label: voice ? `تعليق بصوت ${voice.name} (${voice.dialect})` : "عمل صوتي مولّد",
    cta: "جرّب توليد الصوت ←",
    href: "/tts",
  };
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const item = await loadItem(id);
  if (!item) return { title: "منصة مقام" };

  const d = describe(item);
  const title = `${item.title || d.label} — منصة مقام`;
  const description =
    item.content?.slice(0, 160) ||
    "عمل أنشأه أحد مستخدمي مقام — المنصة العربية لتوليد الأصوات والأغاني والوسائط بالذكاء الاصطناعي.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: item.kind === "video" ? "video.other" : item.kind === "song" ? "music.song" : "website",
      ...(item.kind === "image" && { images: [{ url: item.url }] }),
      ...(item.kind === "video" && { videos: [{ url: item.url }] }),
    },
    twitter: {
      card: item.kind === "image" ? "summary_large_image" : "summary",
      title,
      description,
      ...(item.kind === "image" && { images: [item.url] }),
    },
  };
}

export default async function ShareItemPage({ params }: Params) {
  const { id } = await params;
  const item = await loadItem(id);

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <span className="text-5xl">🔗</span>
        <h1 className="mt-4 text-2xl font-bold">هذا الرابط لم يعد متاحاً</h1>
        <p className="mt-2 text-muted">ربما سحب صاحب العمل نشره أو حُذف العمل.</p>
        <Link
          href="/gallery"
          className="mt-6 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-strong"
        >
          تصفح معرض الإبداعات ←
        </Link>
      </div>
    );
  }

  const d = describe(item);
  const downloadUrl = `${item.url}&download`;

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-3xl border border-border-soft bg-surface-card p-8">
        <p className="text-sm text-muted">من معرض إبداعات مستخدمي منصة مقام</p>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">
          {d.icon} {item.title || d.label}
        </h1>
        <p className="mt-1 text-xs text-muted">
          {d.label} ·{" "}
          {new Date(item.created_at).toLocaleDateString("ar", { dateStyle: "long" })}
        </p>

        {item.content && (
          <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-surface-raised p-4 text-sm leading-relaxed text-muted">
            {item.content.slice(0, 600)}
          </p>
        )}

        {item.kind === "image" ? (
          // رابط موقّع مؤقت من التخزين — مكوّن الصور المحسّنة لا يخدمه
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.title ?? "صورة"} className="mt-6 w-full rounded-2xl" />
        ) : item.kind === "video" ? (
          <video controls src={item.url} className="mt-6 w-full rounded-2xl" preload="metadata" />
        ) : (
          <audio controls src={item.url} className="mt-6 w-full" preload="metadata" />
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <ShareActions path={`/share/item/${item.id}`} title={item.title || d.label} />
          <a
            href={downloadUrl}
            className="rounded-lg border border-border-soft px-3 py-1.5 text-xs text-muted transition-colors hover:border-primary hover:text-primary"
          >
            ⬇ تنزيل
          </a>
        </div>

        <div className="mt-8 border-t border-border-soft pt-6 text-center">
          <p className="text-sm text-muted">أُنشئ هذا العمل بالذكاء الاصطناعي على منصة مقام</p>
          <Link
            href={d.href}
            className="mt-3 inline-block rounded-xl bg-primary px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-strong"
          >
            {d.cta}
          </Link>
        </div>
      </div>
    </div>
  );
}
